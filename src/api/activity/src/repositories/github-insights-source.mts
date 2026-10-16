import type { Logger } from 'winston';
import { GitHubError } from '../errors/index.mjs';
import {
  Cloud,
  IacTool,
  MANIFEST_NAMES,
  cloudOfProvider,
  findIacRoots,
  isDeployWorkflow,
  isExcludedPath,
  isTestPath,
  manifestFrameworks,
  npmFrameworks,
  terraformProviders,
} from '../services/insights/classify.mjs';
import type { Framework, IacRoots } from '../services/insights/classify.mjs';
import { weekStart } from '../services/snapshot-builder.mjs';
import { fail, ok } from '../types/index.mjs';
import type { CommitDetail, CommitRef, GitHubClient, InsightsSource, RepoTarget, RestResponse } from '../interfaces/index.mjs';
import { monthSpan } from '../services/insights/aggregate.mjs';
import type { CareerYear, PullRequestCounts, PullRequestSummary, RepoRuns, RepoScan, Result } from '../types/index.mjs';

const MAX_MANIFESTS: number = 10;
const MAX_TF_FILES: number = 6;
const MAX_COMMIT_PAGES: number = 10;
const MAX_RUN_PAGES: number = 5;
const MAX_PR_PAGES: number = 10;

const CODE_EXT: RegExp = /\.(m?[jt]sx?|mts|cts|cs|py|go|dart|java|kt|swift|rs|rb|php|tf|bicep|html|s?css|sh|ps1|sql|vue|svelte)$/i;
const SKIP_MANIFEST_DIRS: RegExp = /(^|\/)(node_modules|examples?|samples?|fixtures|templates?|test|tests|e2e|\.?vendor)\//i;

interface TreeEntry {
  path: string;
  type: string;
  size?: number;
}

interface ContentsResponse {
  content?: string;
  encoding?: string;
}

interface CommitListItem {
  sha: string;
  commit: { author: { date: string } | null; committer: { date: string } | null };
  parents: unknown[];
}

interface CommitDetailResponse extends CommitListItem {
  commit: CommitListItem['commit'] & { message: string };
  files?: { filename: string; additions: number; deletions: number }[];
}

interface RunsResponse {
  workflow_runs: { name: string | null; path: string; conclusion: string | null; created_at: string }[];
}

interface ContributionReposResponse {
  user: {
    contributionsCollection: {
      commitContributionsByRepository: {
        repository: { nameWithOwner: string; databaseId: number; isPrivate: boolean; pushedAt: string; defaultBranchRef: { name: string } | null };
      }[];
    };
  } | null;
}

interface PrSearchResponse {
  search: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: ({ createdAt?: string; mergedAt?: string | null; repository?: { isPrivate: boolean } } | null)[];
  };
}

type YearCollection = {
  contributionCalendar: { totalContributions: number };
  restrictedContributionsCount: number;
  totalCommitContributions: number;
  totalPullRequestContributions: number;
};

const decode = (c: ContentsResponse | null): string =>
  c?.content && c.encoding === 'base64' ? Buffer.from(c.content, 'base64').toString('utf8') : '';

const enc = (path: string): string => path.split('/').map(encodeURIComponent).join('/');

export class GitHubInsightsSource implements InsightsSource {

  private readonly client: GitHubClient;
  private readonly login: string;
  private readonly logger: Logger;
  private remaining: number | null = null;

  public constructor(client: GitHubClient, login: string, logger: Logger) {
    this.client = client;
    this.login = login;
    this.logger = logger;
  }

  public rateRemaining(): number | null {
    return this.remaining;
  }

  public async repoTargets(fromIso: string, toIso: string): Promise<Result<RepoTarget[]>> {
    const res: Result<ContributionReposResponse> = await this.client.graphql<ContributionReposResponse>(
      `query($login:String!,$from:DateTime!,$to:DateTime!){ user(login:$login){ contributionsCollection(from:$from,to:$to){
        commitContributionsByRepository(maxRepositories:100){ repository{ nameWithOwner databaseId isPrivate pushedAt defaultBranchRef{name} } } } } }`,
      { login: this.login, from: fromIso, to: toIso },
    );
    if (!res.ok) return res;
    const repos = res.value.user?.contributionsCollection.commitContributionsByRepository ?? [];
    return ok(
      repos.map((r: (typeof repos)[number]): RepoTarget => ({
        fullName: r.repository.nameWithOwner,
        databaseId: r.repository.databaseId,
        isPrivate: r.repository.isPrivate,
        pushedAt: r.repository.pushedAt,
        defaultBranch: r.repository.defaultBranchRef?.name ?? null,
      })),
    );
  }

  public async scanRepo(target: RepoTarget, nowIso: string): Promise<Result<RepoScan>> {
    const empty: RepoScan = {
      repo: target.fullName,
      isPrivate: target.isPrivate,
      pushedAt: target.pushedAt,
      scannedAt: nowIso,
      roots: { cdk: [], pulumi: [], cloudformation: [], serverless: [] },
      tools: [],
      frameworks: [],
      providers: [],
      clouds: [],
      testBytes: 0,
      codeBytes: 0,
      commitsListedUntil: null,
    };
    if (!target.defaultBranch) return ok(empty);

    const tree: Result<RestResponse<{ tree: TreeEntry[]; truncated: boolean }>> = await this.get<{ tree: TreeEntry[]; truncated: boolean }>(
      `/repos/${target.fullName}/git/trees/${encodeURIComponent(target.defaultBranch)}?recursive=1`,
    );
    if (!tree.ok) return tree.error instanceof GitHubError && [404, 409].includes(tree.error.status) ? ok(empty) : tree;
    const blobs: TreeEntry[] = (tree.value.data?.tree ?? []).filter((e: TreeEntry): boolean => e.type === 'blob');
    const paths: string[] = blobs.map((b: TreeEntry): string => b.path);

    // Manifests -> frameworks, plus package.json files that make a directory a CDK project.
    const manifests: string[] = paths
      .filter((p: string): boolean => MANIFEST_NAMES.test(p) && !SKIP_MANIFEST_DIRS.test(p) && !isExcludedPath(p))
      .sort((a: string, b: string): number => a.split('/').length - b.split('/').length)
      .slice(0, MAX_MANIFESTS);
    const frameworks: Map<string, Framework> = new Map();
    const cdkPackageDirs: string[] = [];
    const clouds: Set<string> = new Set();
    for (const path of manifests) {
      const text: string = await this.content(target.fullName, path, target.defaultBranch);
      const name: string = path.slice(path.lastIndexOf('/') + 1);
      const dir: string = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      const found: Framework[] =
        name === 'package.json'
          ? ((): Framework[] => {
              const r: { frameworks: Framework[]; usesCdk: boolean } = npmFrameworks(text);
              if (r.usesCdk) cdkPackageDirs.push(dir);
              if (/"@pulumi\/aws"/.test(text)) clouds.add(Cloud.Aws);
              if (/"@pulumi\/azure(-native)?"/.test(text)) clouds.add(Cloud.Azure);
              if (/"@pulumi\/gcp"/.test(text)) clouds.add(Cloud.Gcp);
              return r.frameworks;
            })()
          : manifestFrameworks(name, text);
      for (const f of found) frameworks.set(f.name, f);
    }

    const roots: IacRoots = findIacRoots(paths, cdkPackageDirs);
    const tools: Set<string> = new Set();
    if (paths.some((p: string): boolean => /\.(tf|tf\.json)$/.test(p) && !isExcludedPath(p))) tools.add(IacTool.Terraform);
    if (paths.some((p: string): boolean => /\.bicep$/.test(p))) tools.add(IacTool.Bicep);
    if (roots.cdk.length) tools.add(IacTool.Cdk);
    if (roots.pulumi.length) tools.add(IacTool.Pulumi);
    if (roots.cloudformation.length) tools.add(IacTool.CloudFormation);
    if (roots.serverless.length) tools.add(IacTool.Serverless);
    if (tools.has(IacTool.Cdk) || tools.has(IacTool.CloudFormation) || tools.has(IacTool.Serverless)) clouds.add(Cloud.Aws);
    if (tools.has(IacTool.Bicep)) clouds.add(Cloud.Azure);

    // Terraform providers: lock files are authoritative; fall back to provider blocks.
    const providers: Set<string> = new Set();
    if (tools.has(IacTool.Terraform)) {
      const locks: string[] = paths.filter((p: string): boolean => /(^|\/)\.terraform\.lock\.hcl$/.test(p) && !isExcludedPath(p));
      const tfFiles: string[] = paths.filter((p: string): boolean => /(^|\/)(providers|versions|main|terraform|provider)\.tf$/.test(p) && !isExcludedPath(p));
      for (const path of [...locks, ...tfFiles].slice(0, MAX_TF_FILES)) {
        for (const p of terraformProviders(await this.content(target.fullName, path, target.defaultBranch))) providers.add(p);
      }
      for (const p of providers) {
        const c: string | null = cloudOfProvider(p);
        if (c) clouds.add(c);
      }
    }

    let testBytes: number = 0;
    let codeBytes: number = 0;
    for (const b of blobs) {
      if (isExcludedPath(b.path) || !CODE_EXT.test(b.path)) continue;
      if (isTestPath(b.path)) testBytes += b.size ?? 0;
      else codeBytes += b.size ?? 0;
    }

    return ok({
      ...empty,
      roots,
      tools: [...tools].sort(),
      frameworks: [...frameworks.values()].sort((a: Framework, b: Framework): number => a.name.localeCompare(b.name)),
      providers: [...providers].sort(),
      clouds: [...clouds].sort(),
      testBytes,
      codeBytes,
    });
  }

  public async listMyCommits(fullName: string, sinceIso: string): Promise<Result<CommitRef[]>> {
    const out: CommitRef[] = [];
    for (let page: number = 1; page <= MAX_COMMIT_PAGES; page += 1) {
      const res: Result<RestResponse<CommitListItem[]>> = await this.get<CommitListItem[]>(
        `/repos/${fullName}/commits?author=${encodeURIComponent(this.login)}&since=${sinceIso}&per_page=100&page=${page}`,
      );
      if (!res.ok) return res.error instanceof GitHubError && [404, 409].includes(res.error.status) ? ok(out) : res;
      const items: CommitListItem[] = res.value.data ?? [];
      for (const c of items) {
        out.push({ sha: c.sha, date: c.commit.author?.date ?? c.commit.committer?.date ?? '', isMerge: c.parents.length > 1 });
      }
      if (items.length < 100) break;
    }
    return ok(out);
  }

  public async commitDetail(fullName: string, sha: string): Promise<Result<CommitDetail | null>> {
    const res: Result<RestResponse<CommitDetailResponse>> = await this.get<CommitDetailResponse>(`/repos/${fullName}/commits/${sha}`);
    if (!res.ok) return res.error instanceof GitHubError && [404, 409, 422].includes(res.error.status) ? ok(null) : res;
    const c: CommitDetailResponse | null = res.value.data;
    if (!c) return ok(null);
    return ok({
      sha: c.sha,
      date: c.commit.author?.date ?? c.commit.committer?.date ?? '',
      message: c.commit.message,
      isMerge: c.parents.length > 1,
      files: (c.files ?? []).map((f: { filename: string; additions: number; deletions: number }) => ({
        filename: f.filename,
        additions: f.additions,
        deletions: f.deletions,
      })),
    });
  }

  public async pullRequests(
    fromIso: string,
    nowIso: string,
    probeRepo: string | null,
  ): Promise<Result<{ items: PullRequestSummary[]; counts: PullRequestCounts; includePrivate: boolean }>> {
    const items: PullRequestSummary[] = [];
    let after: string | null = null;
    for (let page: number = 0; page < MAX_PR_PAGES; page += 1) {
      const res: Result<PrSearchResponse> = await this.client.graphql<PrSearchResponse>(
        `query($q:String!,$after:String){ search(type:ISSUE, query:$q, first:100, after:$after){
          pageInfo{hasNextPage endCursor} nodes{ ... on PullRequest { createdAt mergedAt repository{ isPrivate } } } } }`,
        { q: `is:pr author:${this.login} created:>=${fromIso.slice(0, 10)}`, after },
      );
      if (!res.ok) return res;
      for (const n of res.value.search.nodes) {
        if (n?.createdAt) items.push({ createdAt: n.createdAt, mergedAt: n.mergedAt ?? null, isPrivate: n.repository?.isPrivate ?? false });
      }
      if (!res.value.search.pageInfo.hasNextPage) break;
      after = res.value.search.pageInfo.endCursor;
    }
    const counts: Result<PullRequestCounts> = await this.pullRequestCounts(fromIso, nowIso);
    if (!counts.ok) return counts;
    // Private PRs are only visible with the App's "Pull requests: read" permission. Probe one private repo.
    let includePrivate: boolean = probeRepo === null;
    if (probeRepo) {
      const probe: Result<RestResponse<unknown[]>> = await this.get<unknown[]>(`/repos/${probeRepo}/pulls?state=all&per_page=1`);
      includePrivate = probe.ok;
    }
    return ok({ items, counts: counts.value, includePrivate });
  }

  /** Exact totals and per-month counts in one query of aliased searches (search lists cap at 1,000). */
  private async pullRequestCounts(fromIso: string, nowIso: string): Promise<Result<PullRequestCounts>> {
    const from: string = fromIso.slice(0, 10);
    const to: string = nowIso.slice(0, 10);
    const months: string[] = monthSpan(new Date(fromIso), new Date(nowIso));
    const q = (extra: string): string => JSON.stringify(`is:pr author:${this.login} ${extra}`);
    const parts: string[] = [
      `total: search(type:ISSUE, query:${q(`created:${from}..${to}`)}, first:0){ issueCount }`,
      `totalMerged: search(type:ISSUE, query:${q(`is:merged created:${from}..${to}`)}, first:0){ issueCount }`,
    ];
    for (const m of months) {
      const [y, mo] = m.split('-').map(Number) as [number, number];
      const start: string = m === months[0] ? from : `${m}-01`;
      const end: string = m === months[months.length - 1] ? to : new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
      const key: string = m.replace('-', '_');
      parts.push(`o${key}: search(type:ISSUE, query:${q(`created:${start}..${end}`)}, first:0){ issueCount }`);
      parts.push(`m${key}: search(type:ISSUE, query:${q(`is:merged merged:${start}..${end}`)}, first:0){ issueCount }`);
    }
    const res: Result<Record<string, { issueCount: number }>> = await this.client.graphql<Record<string, { issueCount: number }>>(
      `query { ${parts.join(' ')} }`,
      {},
    );
    if (!res.ok) return res;
    const monthly: PullRequestCounts['monthly'] = {};
    for (const m of months) {
      const key: string = m.replace('-', '_');
      monthly[m] = { opened: res.value[`o${key}`]?.issueCount ?? 0, merged: res.value[`m${key}`]?.issueCount ?? 0 };
    }
    return ok({ opened: res.value['total']?.issueCount ?? 0, merged: res.value['totalMerged']?.issueCount ?? 0, monthly });
  }

  public async workflowRuns(target: RepoTarget, fromIso: string, nowIso: string): Promise<Result<RepoRuns>> {
    const weekly: RepoRuns['weekly'] = {};
    for (let page: number = 1; page <= MAX_RUN_PAGES; page += 1) {
      const res: Result<RestResponse<RunsResponse>> = await this.get<RunsResponse>(
        `/repos/${target.fullName}/actions/runs?actor=${encodeURIComponent(this.login)}&created=%3E%3D${fromIso.slice(0, 10)}&per_page=100&page=${page}`,
      );
      if (!res.ok) {
        const denied: boolean = res.error instanceof GitHubError && [403, 404].includes(res.error.status);
        if (denied) return ok({ repo: target.fullName, isPrivate: target.isPrivate, fetchedAt: nowIso, weekly, denied: true });
        return res;
      }
      const runs: RunsResponse['workflow_runs'] = res.value.data?.workflow_runs ?? [];
      for (const r of runs) {
        const key: string = weekStart(r.created_at);
        const row: RepoRuns['weekly'][string] = weekly[key] ?? { succeeded: 0, failed: 0, other: 0, deploys: 0 };
        if (r.conclusion === 'success') row.succeeded += 1;
        else if (r.conclusion === 'failure' || r.conclusion === 'timed_out' || r.conclusion === 'startup_failure') row.failed += 1;
        else row.other += 1;
        if (r.conclusion === 'success' && isDeployWorkflow(r.name ?? '', r.path)) row.deploys += 1;
        weekly[key] = row;
      }
      if (runs.length < 100) break;
    }
    return ok({ repo: target.fullName, isPrivate: target.isPrivate, fetchedAt: nowIso, weekly, denied: false });
  }

  public async career(nowIso: string): Promise<Result<{ joinedYear: number | null; years: CareerYear[] }>> {
    const who: Result<{ user: { createdAt: string } | null }> = await this.client.graphql<{ user: { createdAt: string } | null }>(
      'query($login:String!){ user(login:$login){ createdAt } }',
      { login: this.login },
    );
    if (!who.ok) return who;
    if (!who.value.user) return fail(new Error(`GitHub user ${this.login} not found`));
    const joined: number = new Date(who.value.user.createdAt).getUTCFullYear();
    const thisYear: number = new Date(nowIso).getUTCFullYear();
    const fields: string = 'contributionCalendar{totalContributions} restrictedContributionsCount totalCommitContributions totalPullRequestContributions';
    const parts: string[] = [];
    for (let y: number = joined; y <= thisYear; y += 1) {
      const to: string = y === thisYear ? nowIso : `${y}-12-31T23:59:59Z`;
      parts.push(`y${y}: contributionsCollection(from:"${y}-01-01T00:00:00Z", to:"${to}"){ ${fields} }`);
    }
    const res: Result<{ user: Record<string, YearCollection> | null }> = await this.client.graphql<{ user: Record<string, YearCollection> | null }>(
      `query($login:String!){ user(login:$login){ ${parts.join(' ')} } }`,
      { login: this.login },
    );
    if (!res.ok) return res;
    const years: CareerYear[] = Object.entries(res.value.user ?? {}).map(([key, c]: [string, YearCollection]): CareerYear => ({
      year: Number(key.slice(1)),
      contributions: c.contributionCalendar.totalContributions,
      privateContributions: c.restrictedContributionsCount,
      commits: c.totalCommitContributions,
      pullRequests: c.totalPullRequestContributions,
    }));
    return ok({ joinedYear: joined, years: years.sort((a: CareerYear, b: CareerYear): number => a.year - b.year) });
  }

  private async content(fullName: string, path: string, ref: string): Promise<string> {
    const res: Result<RestResponse<ContentsResponse>> = await this.get<ContentsResponse>(
      `/repos/${fullName}/contents/${enc(path)}?ref=${encodeURIComponent(ref)}`,
    );
    if (!res.ok) {
      this.logger.debug('content fetch failed', { path, error: res.error.message });
      return '';
    }
    return decode(res.value.data);
  }

  private async get<T>(path: string): Promise<Result<RestResponse<T>>> {
    const res: Result<RestResponse<T>> = await this.client.rest<T>(path);
    if (res.ok && res.value.rateRemaining !== null) this.remaining = res.value.rateRemaining;
    return res;
  }
}

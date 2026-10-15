import type { Logger } from 'winston';
import { CONTRIBUTIONS_QUERY } from '../clients/index.mjs';
import { applyEnrichment, buildSnapshot, mergeChurn } from '../services/snapshot-builder.mjs';
import type { ContributorWeek } from '../services/snapshot-builder.mjs';
import { fail, ok, RefreshDepth } from '../types/index.mjs';
import type {
  AppConfig,
  ContributionCollector,
  ContributionsResponse,
  GitHubClient,
  RestResponse,
} from '../interfaces/index.mjs';
import type { ActivitySnapshot, ChurnWeek, RepoActivity, Result } from '../types/index.mjs';

const YEAR_MS: number = 365 * 24 * 60 * 60 * 1000;
const MAX_COMMIT_PAGES: number = 3;
const STATS_RETRIES: number = 3;
const STATS_RETRY_MS: number = 1500;

interface CommitListItem {
  commit: { author: { date: string } | null };
}

interface ContributorStat {
  author: { login: string } | null;
  weeks: ContributorWeek[];
}

/** Data access for GitHub: one GraphQL call (shallow), plus REST enrichment (deep). */
export class GitHubContributionCollector implements ContributionCollector {

  private readonly client: GitHubClient;
  private readonly config: AppConfig;
  private readonly logger: Logger;
  private readonly clock: () => Date;
  private readonly sleep: (ms: number) => Promise<void>;

  public constructor(
    client: GitHubClient,
    config: AppConfig,
    logger: Logger,
    clock: () => Date,
    sleep: (ms: number) => Promise<void> = (ms: number): Promise<void> => Bun.sleep(ms),
  ) {
    this.client = client;
    this.config = config;
    this.logger = logger;
    this.clock = clock;
    this.sleep = sleep;
  }

  public async collect(
    depth: RefreshDepth,
    previous: ActivitySnapshot | null,
  ): Promise<Result<ActivitySnapshot>> {
    const now: Date = this.clock();
    const from: Date = new Date(now.getTime() - YEAR_MS);
    const res: Result<ContributionsResponse> = await this.client.graphql<ContributionsResponse>(
      CONTRIBUTIONS_QUERY,
      { login: this.config.login, from: from.toISOString(), to: now.toISOString() },
    );
    if (!res.ok) return res;
    if (!res.value.user) return fail(new Error(`GitHub user ${this.config.login} not found`));

    const snapshot: ActivitySnapshot = buildSnapshot({
      login: this.config.login,
      timezone: this.config.timezone,
      now,
      collection: res.value.user.contributionsCollection,
      previous,
    });
    if (depth === RefreshDepth.Shallow) return ok(snapshot);

    const timestamps: string[] = [];
    const churnSeries: ContributorWeek[][] = [];
    let churnComplete: boolean = true;
    for (const repo of snapshot.repos) {
      timestamps.push(...(await this.commitTimestamps(repo, from)));
      const weeks: ContributorWeek[] | null = await this.contributorWeeks(repo);
      if (weeks === null) churnComplete = false;
      else churnSeries.push(weeks);
    }
    const churn: ChurnWeek[] | null = churnComplete ? mergeChurn(churnSeries, from.toISOString()) : null;
    if (!churnComplete) this.logger.info('contributor stats still computing; keeping previous churn');
    return ok(applyEnrichment(snapshot, { commitTimestamps: timestamps, churn, now }));
  }

  private async commitTimestamps(repo: RepoActivity, from: Date): Promise<string[]> {
    const out: string[] = [];
    for (let page: number = 1; page <= MAX_COMMIT_PAGES; page += 1) {
      const path: string =
        `/repos/${repo.name}/commits?author=${encodeURIComponent(this.config.login)}` +
        `&since=${from.toISOString()}&per_page=100&page=${page}`;
      const res: Result<RestResponse<CommitListItem[]>> = await this.client.rest<CommitListItem[]>(path);
      if (!res.ok) {
        this.logger.warn('commit list failed', { repo: repo.name, error: res.error.message });
        break;
      }
      const items: CommitListItem[] = res.value.data ?? [];
      for (const item of items) {
        if (item.commit.author?.date) out.push(item.commit.author.date);
      }
      if (items.length < 100) break;
    }
    return out;
  }

  /** Returns null while GitHub is still computing stats (HTTP 202) after a few retries. */
  private async contributorWeeks(repo: RepoActivity): Promise<ContributorWeek[] | null> {
    let res: Result<RestResponse<ContributorStat[]>> = await this.client.rest<ContributorStat[]>(
      `/repos/${repo.name}/stats/contributors`,
    );
    for (let attempt: number = 1; attempt <= STATS_RETRIES && res.ok && res.value.status === 202; attempt += 1) {
      await this.sleep(STATS_RETRY_MS * attempt);
      res = await this.client.rest<ContributorStat[]>(`/repos/${repo.name}/stats/contributors`);
    }
    if (!res.ok) {
      this.logger.warn('contributor stats failed', { repo: repo.name, error: res.error.message });
      return [];
    }
    if (res.value.status === 202) return null;
    const login: string = this.config.login.toLowerCase();
    const mine: ContributorStat | undefined = (res.value.data ?? []).find(
      (s: ContributorStat): boolean => s.author?.login.toLowerCase() === login,
    );
    return mine?.weeks ?? [];
  }
}

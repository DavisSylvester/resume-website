import type { Logger } from 'winston';
import { mapLimit } from '../../util/map-limit.mjs';
import { aggregateInsights } from './aggregate.mjs';
import { ledgerRepoKey, toLedgerCommit } from './ledger.mjs';
import { ok } from '../../types/index.mjs';
import type {
  CommitDetail,
  CommitRef,
  InsightsRepository,
  InsightsService,
  InsightsSource,
  RepoTarget,
} from '../../interfaces/index.mjs';
import type { IacRoots } from './classify.mjs';
import type {
  CareerYear,
  Insights,
  InsightsMeta,
  LedgerCommit,
  PendingCommit,
  PullRequestCounts,
  PullRequestSummary,
  RepoRuns,
  RepoScan,
  Result,
} from '../../types/index.mjs';

const YEAR_MS: number = 365 * 86_400_000;
const HOUR_MS: number = 3_600_000;
const LEDGER_TTL_DAYS: number = 400;
const NO_ROOTS: IacRoots = { cdk: [], pulumi: [], cloudformation: [], serverless: [] };

export interface InsightsBudgets {
  /** Commit details fetched per scheduled run. */
  scheduled: number;
  /** Commit details fetched per push-triggered run. */
  push: number;
  concurrency: number;
  /** Stop calling GitHub when the remaining rate limit drops below this. */
  minRate: number;
}

export const DEFAULT_BUDGETS: InsightsBudgets = { scheduled: 300, push: 50, concurrency: 6, minRate: 500 };

const emptyMeta = (): InsightsMeta => ({
  pullRequests: [],
  pullRequestsFetchedAt: null,
  pullRequestsIncludePrivate: false,
  career: { joinedYear: null, years: [] },
  careerFetchedAt: null,
  runsFetchedAt: null,
  actionsIncludePrivate: false,
});

const olderThan = (iso: string | null, ms: number, now: Date): boolean => iso === null || now.getTime() - Date.parse(iso) > ms;

/**
 * Incremental insights refresh. Each scheduled run rescans only repositories whose pushedAt
 * changed, queues commits it has not classified yet, and classifies a bounded number of them,
 * so the first 12-month backfill spreads over several runs without exhausting the rate limit.
 */
export class DefaultInsightsService implements InsightsService {

  private readonly store: InsightsRepository;
  private readonly source: InsightsSource;
  private readonly logger: Logger;
  private readonly clock: () => Date;
  private readonly budgets: InsightsBudgets;

  public constructor(
    store: InsightsRepository,
    source: InsightsSource,
    logger: Logger,
    clock: () => Date,
    budgets: InsightsBudgets = DEFAULT_BUDGETS,
  ) {
    this.store = store;
    this.source = source;
    this.logger = logger;
    this.clock = clock;
    this.budgets = budgets;
  }

  public enqueue(items: PendingCommit[]): Promise<Result<void>> {
    return this.store.putPending(items);
  }

  public async refreshScheduled(reviews: number): Promise<Result<Insights>> {
    const now: Date = this.clock();
    const from: Date = new Date(now.getTime() - YEAR_MS);
    const fromIso: string = from.toISOString();

    const targets: Result<RepoTarget[]> = await this.source.repoTargets(fromIso, now.toISOString());
    if (!targets.ok) return targets;
    const scans: Result<RepoScan[]> = await this.store.listScans();
    if (!scans.ok) return scans;
    const ledger: Result<LedgerCommit[]> = await this.store.listLedger(fromIso);
    if (!ledger.ok) return ledger;
    const pending: Result<PendingCommit[]> = await this.store.listPending(100_000);
    if (!pending.ok) return pending;

    const scanByRepo: Map<string, RepoScan> = new Map(scans.value.map((s: RepoScan): [string, RepoScan] => [s.repo, s]));
    const known: Set<string> = new Set([
      ...ledger.value.map((c: LedgerCommit): string => c.sha),
      ...pending.value.map((p: PendingCommit): string => p.sha),
    ]);

    let queued: number = 0;
    for (const target of targets.value) {
      if (this.lowRate()) break;
      queued += await this.syncRepo(target, scanByRepo, known, from, now);
    }
    const classified: number = await this.processPending(this.budgets.scheduled, scanByRepo);
    await this.refreshSlowInputs(targets.value, from, now);
    this.logger.info('insights scheduled refresh', { repos: targets.value.length, queued, classified, rateRemaining: this.source.rateRemaining() });
    return this.aggregate(reviews, now, from);
  }

  public async refreshAfterPush(reviews: number): Promise<Result<Insights>> {
    const now: Date = this.clock();
    const scans: Result<RepoScan[]> = await this.store.listScans();
    if (!scans.ok) return scans;
    const scanByRepo: Map<string, RepoScan> = new Map(scans.value.map((s: RepoScan): [string, RepoScan] => [s.repo, s]));
    const classified: number = await this.processPending(this.budgets.push, scanByRepo);
    this.logger.info('insights push refresh', { classified });
    return this.aggregate(reviews, now, new Date(now.getTime() - YEAR_MS));
  }

  /** Rescans a repo if it changed and queues my commits that are not classified yet. Returns how many were queued. */
  private async syncRepo(target: RepoTarget, scanByRepo: Map<string, RepoScan>, known: Set<string>, from: Date, now: Date): Promise<number> {
    const nowIso: string = now.toISOString();
    let scan: RepoScan | undefined = scanByRepo.get(target.fullName);
    const changed: boolean = !scan || scan.pushedAt !== target.pushedAt || scan.isPrivate !== target.isPrivate;
    if (!changed && scan?.commitsListedUntil) return 0;

    if (changed) {
      const res: Result<RepoScan> = await this.source.scanRepo(target, nowIso);
      if (!res.ok) {
        this.logger.warn('repo scan failed', { repo: target.isPrivate ? 'private' : target.fullName, error: res.error.message });
        return 0;
      }
      scan = { ...res.value, commitsListedUntil: scan?.commitsListedUntil ?? null };
    }
    if (!scan) return 0;

    // Re-list a two-day overlap so commits pushed with older author dates are not missed.
    const since: string = scan.commitsListedUntil
      ? new Date(Math.max(from.getTime(), Date.parse(scan.commitsListedUntil) - 2 * 86_400_000)).toISOString()
      : from.toISOString();
    const commits: Result<CommitRef[]> = await this.source.listMyCommits(target.fullName, since);
    let queued: PendingCommit[] = [];
    if (commits.ok) {
      queued = commits.value
        .filter((c: CommitRef): boolean => c.date >= from.toISOString() && !known.has(c.sha))
        .map((c: CommitRef): PendingCommit => ({
          sha: c.sha,
          repo: ledgerRepoKey(target.fullName, target.isPrivate, target.databaseId),
          isPrivate: target.isPrivate,
          fullName: target.fullName,
          queuedAt: nowIso,
        }));
      for (const p of queued) known.add(p.sha);
      if (queued.length) await this.store.putPending(queued);
      scan = { ...scan, commitsListedUntil: nowIso };
    }
    await this.store.putScan(scan);
    scanByRepo.set(scan.repo, scan);
    return queued.length;
  }

  /** Classifies up to `budget` queued commits. Returns how many were written to the ledger. */
  private async processPending(budget: number, scanByRepo: Map<string, RepoScan>): Promise<number> {
    const pending: Result<PendingCommit[]> = await this.store.listPending(budget);
    if (!pending.ok || pending.value.length === 0) return 0;

    const results: { p: PendingCommit; detail: Result<CommitDetail | null> | null }[] = await mapLimit(
      pending.value,
      this.budgets.concurrency,
      async (p: PendingCommit): Promise<{ p: PendingCommit; detail: Result<CommitDetail | null> | null }> => ({
        p,
        detail: this.lowRate() ? null : await this.source.commitDetail(p.fullName, p.sha),
      }),
    );

    const records: LedgerCommit[] = [];
    const done: string[] = [];
    for (const { p, detail } of results) {
      if (!detail || !detail.ok) continue; // retried next run
      done.push(p.sha);
      if (detail.value) records.push(toLedgerCommit(detail.value, p.repo, p.isPrivate, scanByRepo.get(p.fullName)?.roots ?? NO_ROOTS));
    }
    if (records.length) {
      const put: Result<void> = await this.store.putLedger(records, LEDGER_TTL_DAYS);
      if (!put.ok) return 0;
    }
    if (done.length) await this.store.deletePending(done);
    return records.length;
  }

  /** PRs hourly; career years and workflow runs daily. */
  private async refreshSlowInputs(targets: RepoTarget[], from: Date, now: Date): Promise<void> {
    const metaRes: Result<InsightsMeta | null> = await this.store.getMeta();
    const meta: InsightsMeta = (metaRes.ok ? metaRes.value : null) ?? emptyMeta();
    const nowIso: string = now.toISOString();
    const privateTargets: RepoTarget[] = targets.filter((t: RepoTarget): boolean => t.isPrivate);

    if (olderThan(meta.pullRequestsFetchedAt, 55 * 60_000, now) && !this.lowRate()) {
      const prs: Result<{ items: PullRequestSummary[]; counts: PullRequestCounts; includePrivate: boolean }> = await this.source.pullRequests(
        from.toISOString(),
        nowIso,
        privateTargets[0]?.fullName ?? null,
      );
      if (prs.ok) {
        meta.pullRequests = prs.value.items;
        meta.pullRequestCounts = prs.value.counts;
        meta.pullRequestsIncludePrivate = prs.value.includePrivate;
        meta.pullRequestsFetchedAt = nowIso;
      } else this.logger.warn('pull request search failed', { error: prs.error.message });
    }

    if (olderThan(meta.careerFetchedAt, 23 * HOUR_MS, now) && !this.lowRate()) {
      const career: Result<{ joinedYear: number | null; years: CareerYear[] }> = await this.source.career(nowIso);
      if (career.ok) {
        meta.career = career.value;
        meta.careerFetchedAt = nowIso;
      } else this.logger.warn('career query failed', { error: career.error.message });
    }

    if (olderThan(meta.runsFetchedAt, 23 * HOUR_MS, now) && !this.lowRate()) {
      const runs: Result<RepoRuns>[] = await mapLimit(targets, 4, (t: RepoTarget): Promise<Result<RepoRuns>> =>
        this.source.workflowRuns(t, from.toISOString(), nowIso),
      );
      for (const r of runs) if (r.ok) await this.store.putRuns(r.value);
      const denied: Set<string> = new Set(
        runs.filter((r: Result<RepoRuns>): boolean => r.ok && r.value.denied).map((r: Result<RepoRuns>): string => (r.ok ? r.value.repo : '')),
      );
      meta.actionsIncludePrivate = privateTargets.length === 0 || privateTargets.some((t: RepoTarget): boolean => !denied.has(t.fullName));
      meta.runsFetchedAt = nowIso;
    }

    await this.store.putMeta(meta);
  }

  private async aggregate(reviews: number, now: Date, from: Date): Promise<Result<Insights>> {
    const [ledger, scans, runs, pendingCount, meta] = await Promise.all([
      this.store.listLedger(from.toISOString()),
      this.store.listScans(),
      this.store.listRuns(),
      this.store.countPending(),
      this.store.getMeta(),
    ]);
    if (!ledger.ok) return ledger;
    if (!scans.ok) return scans;
    if (!runs.ok) return runs;
    const m: InsightsMeta = (meta.ok ? meta.value : null) ?? emptyMeta();
    // Only repositories active in the window count toward stack, cloud and testing figures.
    const active: RepoScan[] = scans.value.filter((s: RepoScan): boolean => s.pushedAt >= from.toISOString());
    const activeRepos: Set<string> = new Set(active.map((s: RepoScan): string => s.repo));
    return ok(
      aggregateInsights({
        now,
        windowFrom: from,
        ledger: ledger.value,
        scans: active,
        pendingCount: pendingCount.ok ? pendingCount.value : 0,
        pullRequests: m.pullRequests,
        pullRequestCounts: m.pullRequestCounts ?? null,
        reviews,
        pullRequestsIncludePrivate: m.pullRequestsIncludePrivate,
        runs: runs.value.filter((r: RepoRuns): boolean => activeRepos.has(r.repo)),
        actionsIncludePrivate: m.actionsIncludePrivate,
        career: m.career,
      }),
    );
  }

  private lowRate(): boolean {
    const r: number | null = this.source.rateRemaining();
    return r !== null && r < this.budgets.minRate;
  }
}

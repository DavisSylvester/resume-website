import type { InsightsMeta, LedgerCommit, PendingCommit, RepoRuns, RepoScan, Result } from '../types/index.mjs';

/** Storage for the insights ledger, cached repository scans, queued pushes and slow-changing meta. */
export interface InsightsRepository {
  listLedger(fromIso: string): Promise<Result<LedgerCommit[]>>;
  putLedger(commits: LedgerCommit[], ttlDays: number): Promise<Result<void>>;
  listScans(): Promise<Result<RepoScan[]>>;
  putScan(scan: RepoScan): Promise<Result<void>>;
  listPending(limit: number): Promise<Result<PendingCommit[]>>;
  countPending(): Promise<Result<number>>;
  putPending(items: PendingCommit[]): Promise<Result<void>>;
  deletePending(shas: string[]): Promise<Result<void>>;
  listRuns(): Promise<Result<RepoRuns[]>>;
  putRuns(runs: RepoRuns): Promise<Result<void>>;
  getMeta(): Promise<Result<InsightsMeta | null>>;
  putMeta(meta: InsightsMeta): Promise<Result<void>>;
}

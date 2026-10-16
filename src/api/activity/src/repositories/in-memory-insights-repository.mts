import { ok } from '../types/index.mjs';
import type { InsightsRepository } from '../interfaces/index.mjs';
import type { InsightsMeta, LedgerCommit, PendingCommit, RepoRuns, RepoScan, Result } from '../types/index.mjs';

/** Test and local-dev twin of DynamoInsightsRepository. */
export class InMemoryInsightsRepository implements InsightsRepository {

  public readonly ledger: Map<string, LedgerCommit> = new Map();
  public readonly scans: Map<string, RepoScan> = new Map();
  public readonly pending: Map<string, PendingCommit> = new Map();
  public readonly runs: Map<string, RepoRuns> = new Map();
  public meta: InsightsMeta | null = null;

  public async listLedger(fromIso: string): Promise<Result<LedgerCommit[]>> {
    return ok([...this.ledger.values()].filter((c: LedgerCommit): boolean => c.date >= fromIso));
  }

  public async putLedger(commits: LedgerCommit[]): Promise<Result<void>> {
    for (const c of commits) this.ledger.set(c.sha, c);
    return ok(undefined);
  }

  public async listScans(): Promise<Result<RepoScan[]>> {
    return ok([...this.scans.values()]);
  }

  public async putScan(scan: RepoScan): Promise<Result<void>> {
    this.scans.set(scan.repo, scan);
    return ok(undefined);
  }

  public async listPending(limit: number): Promise<Result<PendingCommit[]>> {
    return ok([...this.pending.values()].slice(0, limit));
  }

  public async countPending(): Promise<Result<number>> {
    return ok(this.pending.size);
  }

  public async putPending(items: PendingCommit[]): Promise<Result<void>> {
    for (const p of items) this.pending.set(p.sha, p);
    return ok(undefined);
  }

  public async deletePending(shas: string[]): Promise<Result<void>> {
    for (const s of shas) this.pending.delete(s);
    return ok(undefined);
  }

  public async listRuns(): Promise<Result<RepoRuns[]>> {
    return ok([...this.runs.values()]);
  }

  public async putRuns(runs: RepoRuns): Promise<Result<void>> {
    this.runs.set(runs.repo, runs);
    return ok(undefined);
  }

  public async getMeta(): Promise<Result<InsightsMeta | null>> {
    return ok(this.meta);
  }

  public async putMeta(meta: InsightsMeta): Promise<Result<void>> {
    this.meta = meta;
    return ok(undefined);
  }
}

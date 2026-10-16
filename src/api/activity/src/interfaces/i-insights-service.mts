import type { Insights, PendingCommit, Result } from '../types/index.mjs';

export interface InsightsService {
  /** Scheduled: scan changed repos, list new commits, classify a budget of them, refresh slow inputs, aggregate. */
  refreshScheduled(reviews: number): Promise<Result<Insights>>;
  /** After a push: classify queued commits (small budget) and aggregate. */
  refreshAfterPush(reviews: number): Promise<Result<Insights>>;
  enqueue(items: PendingCommit[]): Promise<Result<void>>;
}

import type { ActivitySnapshot, RefreshDepth, Result } from '../types/index.mjs';

/** Pulls activity from GitHub and shapes it into a snapshot. No storage. */
export interface ContributionCollector {
  collect(depth: RefreshDepth, previous: ActivitySnapshot | null): Promise<Result<ActivitySnapshot>>;
}

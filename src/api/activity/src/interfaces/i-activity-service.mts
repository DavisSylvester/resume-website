import type { ActivitySnapshot, LiveEventList, RefreshDepth, Result } from '../types/index.mjs';

export interface ActivityService {
  getSnapshot(): Promise<Result<ActivitySnapshot | null>>;
  getLiveEvents(since: string | null): Promise<Result<LiveEventList>>;
  /** Re-collects from GitHub. When `debounce` is set, skips if the snapshot is fresh. */
  refresh(depth: RefreshDepth, debounce: boolean): Promise<Result<ActivitySnapshot | null>>;
}

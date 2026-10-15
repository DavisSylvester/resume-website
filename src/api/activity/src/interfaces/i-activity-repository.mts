import type { ActivitySnapshot, LiveEvent, Result } from '../types/index.mjs';

export interface ActivityRepository {
  getSnapshot(): Promise<Result<ActivitySnapshot | null>>;
  putSnapshot(snapshot: ActivitySnapshot): Promise<Result<void>>;
  putLiveEvent(event: LiveEvent, ttlDays: number): Promise<Result<void>>;
  /** Newest first, strictly after `since` (ISO timestamp). */
  listLiveEvents(since: string | null, limit: number): Promise<Result<LiveEvent[]>>;
}

import { liveCursor } from './dynamo-activity-repository.mjs';
import { ok } from '../types/index.mjs';
import type { ActivityRepository } from '../interfaces/index.mjs';
import type { ActivitySnapshot, LiveEvent, Result } from '../types/index.mjs';

/** Used by unit tests and the local dev server. Same contract as the DynamoDB repository. */
export class InMemoryActivityRepository implements ActivityRepository {

  private snapshot: ActivitySnapshot | null;
  private readonly events: Map<string, LiveEvent> = new Map();

  public constructor(seed: ActivitySnapshot | null = null) {
    this.snapshot = seed;
  }

  public async getSnapshot(): Promise<Result<ActivitySnapshot | null>> {
    return ok(this.snapshot);
  }

  public async putSnapshot(snapshot: ActivitySnapshot): Promise<Result<void>> {
    this.snapshot = snapshot;
    return ok(undefined);
  }

  public async putLiveEvent(event: LiveEvent): Promise<Result<void>> {
    const key: string = liveCursor(event);
    if (!this.events.has(key)) this.events.set(key, event);
    return ok(undefined);
  }

  public async listLiveEvents(since: string | null, limit: number): Promise<Result<LiveEvent[]>> {
    const sorted: [string, LiveEvent][] = [...this.events.entries()]
      .filter(([key]: [string, LiveEvent]): boolean => since === null || key > since)
      .sort(([a]: [string, LiveEvent], [b]: [string, LiveEvent]): number => b.localeCompare(a));
    return ok(sorted.slice(0, limit).map(([, event]: [string, LiveEvent]): LiveEvent => event));
  }
}

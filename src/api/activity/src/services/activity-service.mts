import type { Logger } from 'winston';
import { liveCursor } from '../repositories/dynamo-activity-repository.mjs';
import { ok } from '../types/index.mjs';
import type {
  ActivityRepository,
  ActivityService,
  AppConfig,
  ContributionCollector,
} from '../interfaces/index.mjs';
import type { ActivitySnapshot, LiveEvent, LiveEventList, RefreshDepth, Result } from '../types/index.mjs';

const LIVE_PAGE_SIZE: number = 25;

export class DefaultActivityService implements ActivityService {

  private readonly repository: ActivityRepository;
  private readonly collector: ContributionCollector;
  private readonly config: AppConfig;
  private readonly logger: Logger;
  private readonly clock: () => Date;

  public constructor(
    repository: ActivityRepository,
    collector: ContributionCollector,
    config: AppConfig,
    logger: Logger,
    clock: () => Date,
  ) {
    this.repository = repository;
    this.collector = collector;
    this.config = config;
    this.logger = logger;
    this.clock = clock;
  }

  public getSnapshot(): Promise<Result<ActivitySnapshot | null>> {
    return this.repository.getSnapshot();
  }

  public async getLiveEvents(since: string | null): Promise<Result<LiveEventList>> {
    const res: Result<LiveEvent[]> = await this.repository.listLiveEvents(since, LIVE_PAGE_SIZE);
    if (!res.ok) return res;
    const newest: LiveEvent | undefined = res.value[0];
    return ok({ events: res.value, cursor: newest ? liveCursor(newest) : (since ?? '') });
  }

  public async refresh(depth: RefreshDepth, debounce: boolean): Promise<Result<ActivitySnapshot | null>> {
    const previous: Result<ActivitySnapshot | null> = await this.repository.getSnapshot();
    if (!previous.ok) return previous;

    if (debounce && previous.value) {
      const ageSeconds: number = (this.clock().getTime() - Date.parse(previous.value.generatedAt)) / 1000;
      if (ageSeconds < this.config.refreshDebounceSeconds) {
        this.logger.debug('refresh skipped by debounce', { ageSeconds });
        return ok(previous.value);
      }
    }

    const collected: Result<ActivitySnapshot> = await this.collector.collect(depth, previous.value);
    if (!collected.ok) return collected;
    const saved: Result<void> = await this.repository.putSnapshot(collected.value);
    if (!saved.ok) return saved;
    this.logger.info('snapshot refreshed', {
      depth,
      contributions: collected.value.totals.contributions,
      privateContributions: collected.value.totals.privateContributions,
    });
    return ok(collected.value);
  }
}

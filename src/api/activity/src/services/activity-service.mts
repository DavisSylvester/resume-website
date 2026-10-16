import type { Logger } from 'winston';
import { liveCursor } from '../repositories/dynamo-activity-repository.mjs';
import { ok, RefreshDepth } from '../types/index.mjs';
import type {
  ActivityRepository,
  ActivityService,
  AppConfig,
  ContributionCollector,
  InsightsService,
} from '../interfaces/index.mjs';
import type { ActivitySnapshot, Insights, LiveEvent, LiveEventList, Result } from '../types/index.mjs';

const LIVE_PAGE_SIZE: number = 25;

export class DefaultActivityService implements ActivityService {

  private readonly repository: ActivityRepository;
  private readonly collector: ContributionCollector;
  private readonly insights: InsightsService | null;
  private readonly config: AppConfig;
  private readonly logger: Logger;
  private readonly clock: () => Date;

  public constructor(
    repository: ActivityRepository,
    collector: ContributionCollector,
    config: AppConfig,
    logger: Logger,
    clock: () => Date,
    insights: InsightsService | null = null,
  ) {
    this.repository = repository;
    this.collector = collector;
    this.insights = insights;
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
    let snapshot: ActivitySnapshot = collected.value;

    // The scheduled (deep) run also advances the insights backfill. A failure keeps the previous insights.
    if (depth === RefreshDepth.Deep && this.insights) {
      const insights: Result<Insights> = await this.insights.refreshScheduled(snapshot.totals.reviews);
      if (insights.ok) snapshot = { ...snapshot, insights: insights.value };
      else this.logger.warn('insights refresh failed; keeping previous insights', { error: insights.error.message });
    }

    const saved: Result<void> = await this.repository.putSnapshot(snapshot);
    if (!saved.ok) return saved;
    this.logger.info('snapshot refreshed', {
      depth,
      contributions: snapshot.totals.contributions,
      privateContributions: snapshot.totals.privateContributions,
      ledgerCommits: snapshot.insights?.coverage.commitsAnalyzed ?? 0,
    });
    return ok(snapshot);
  }

  public async processPush(): Promise<Result<ActivitySnapshot | null>> {
    const refreshed: Result<ActivitySnapshot | null> = await this.refresh(RefreshDepth.Shallow, true);
    if (!refreshed.ok) return refreshed;
    if (!this.insights || !refreshed.value) return refreshed;

    const insights: Result<Insights> = await this.insights.refreshAfterPush(refreshed.value.totals.reviews);
    if (!insights.ok) {
      this.logger.warn('push insights refresh failed', { error: insights.error.message });
      return refreshed;
    }
    const snapshot: ActivitySnapshot = { ...refreshed.value, insights: insights.value };
    const saved: Result<void> = await this.repository.putSnapshot(snapshot);
    return saved.ok ? ok(snapshot) : saved;
  }
}

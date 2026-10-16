import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import type { WritableSignal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ACTIVITY_API_CONFIG } from './activity.config';
import type { ActivityApiConfig } from './activity.config';
import type { ActivitySnapshot, LiveEvent, LiveEventList } from './interfaces';

export const DataSource = {
  Loading: 'loading',
  Live: 'live',
  Sample: 'sample',
  Error: 'error',
} as const;
export type DataSource = (typeof DataSource)[keyof typeof DataSource];

const MAX_FEED: number = 12;
/** GitHub's contribution counts can trail a push by a few minutes, so refetch once more later. */
const LATE_REFETCH_MS: number = 3 * 60 * 1000;

/**
 * Loads the activity snapshot and polls the live push feed while the page is visible.
 * New pushes refresh the snapshot so the charts and headline numbers follow along.
 */
@Injectable({ providedIn: 'root' })
export class ActivityDataService {

  public readonly snapshot: WritableSignal<ActivitySnapshot | null> = signal<ActivitySnapshot | null>(null);
  public readonly liveEvents: WritableSignal<LiveEvent[]> = signal<LiveEvent[]>([]);
  public readonly freshIds: WritableSignal<ReadonlySet<string>> = signal<ReadonlySet<string>>(new Set<string>());
  public readonly source: WritableSignal<DataSource> = signal<DataSource>(DataSource.Loading);
  public readonly refreshing: WritableSignal<boolean> = signal<boolean>(false);

  private readonly http: HttpClient = inject(HttpClient);
  private readonly config: ActivityApiConfig = inject(ACTIVITY_API_CONFIG);
  private cursor: string | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lateTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onVisibility: () => void = (): void => {
    if (document.visibilityState === 'visible') {
      void this.poll();
      this.startTimer();
    } else {
      this.stopTimer();
    }
  };

  public async start(): Promise<void> {
    await this.loadSnapshot();
    if (this.source() !== DataSource.Live) return;
    await this.poll(true);
    this.startTimer();
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  public stop(): void {
    this.stopTimer();
    if (this.lateTimer) clearTimeout(this.lateTimer);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private async loadSnapshot(): Promise<void> {
    // Hold the previous render while refetching: no skeleton flash.
    this.refreshing.set(this.snapshot() !== null);
    try {
      if (this.config.baseUrl) {
        try {
          const live: ActivitySnapshot = await firstValueFrom(
            this.http.get<ActivitySnapshot>(`${this.config.baseUrl}/activity/snapshot`),
          );
          this.snapshot.set(live);
          this.source.set(DataSource.Live);
          return;
        } catch {
          // Fall through to the bundled sample.
        }
      }
      if (this.snapshot() === null) {
        const sample: ActivitySnapshot = await firstValueFrom(this.http.get<ActivitySnapshot>(this.config.sampleUrl));
        this.snapshot.set(sample);
        this.source.set(DataSource.Sample);
      }
    } catch {
      this.source.set(DataSource.Error);
    } finally {
      this.refreshing.set(false);
    }
  }

  private async poll(initial: boolean = false): Promise<void> {
    const since: string = this.cursor ? `?since=${encodeURIComponent(this.cursor)}` : '';
    try {
      const page: LiveEventList = await firstValueFrom(
        this.http.get<LiveEventList>(`${this.config.baseUrl}/activity/live${since}`),
      );
      this.cursor = page.cursor || this.cursor;
      if (page.events.length === 0) return;

      this.liveEvents.update((current: LiveEvent[]): LiveEvent[] => {
        const seen: Set<string> = new Set(current.map((e: LiveEvent): string => e.id));
        const added: LiveEvent[] = page.events.filter((e: LiveEvent): boolean => !seen.has(e.id));
        return [...added, ...current].slice(0, MAX_FEED);
      });
      if (initial) return;

      this.freshIds.set(new Set(page.events.map((e: LiveEvent): string => e.id)));
      await this.loadSnapshot();
      if (this.lateTimer) clearTimeout(this.lateTimer);
      this.lateTimer = setTimeout((): void => void this.loadSnapshot(), LATE_REFETCH_MS);
    } catch {
      // A failed poll is not fatal; the next tick retries.
    }
  }

  private startTimer(): void {
    this.stopTimer();
    this.pollTimer = setInterval((): void => void this.poll(), this.config.pollMs);
  }

  private stopTimer(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }
}

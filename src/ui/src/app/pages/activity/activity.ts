import { Component, computed, inject, signal } from '@angular/core';
import type { OnDestroy, OnInit, Signal, WritableSignal } from '@angular/core';
import { ActivityDataService, DataSource } from '../../activity/activity-data.service';
import { ChurnChart } from '../../activity/charts/churn-chart/churn-chart';
import { compact, whole } from '../../activity/charts/d3-chart';
import { LanguageBars } from '../../activity/charts/language-bars/language-bars';
import { RadialCalendar } from '../../activity/charts/radial-calendar/radial-calendar';
import { RepoStream } from '../../activity/charts/repo-stream/repo-stream';
import { RhythmHeatmap, hourLabel } from '../../activity/charts/rhythm-heatmap/rhythm-heatmap';
import { InsightsSection, TOOL_META } from './insights/insights-section';
import type { ActivitySnapshot, CalendarDay, IacToolStat, LiveEvent } from '../../activity/interfaces';

interface Tile {
  label: string;
  value: string;
  note: string;
}

/** IaC tools that get their own tile in the key-figures row. */
const IAC_KPI_TOOLS: string[] = ['cdk', 'terraform'];

export const iacTile = (tool: string, stats: IacToolStat[]): Tile => {
  const stat: IacToolStat | undefined = stats.find((t: IacToolStat): boolean => t.tool === tool);
  const label: string = `${TOOL_META[tool]?.label ?? tool} commits`;
  if (!stat) return { label, value: '–', note: 'no infrastructure commits yet' };
  return {
    label,
    value: whole.format(stat.commits),
    note: `+${compact.format(stat.linesAdded)} lines · ${stat.reposPresent} ${stat.reposPresent === 1 ? 'repo' : 'repos'}`,
  };
};

/**
 * Reviews on private organization repos only reach GitHub's restricted total, so the review
 * count is usually 0 even when reviews were given; say nothing rather than "0 reviews".
 */
export const pullRequestNote = (reviews: number): string =>
  reviews > 0 ? `${whole.format(reviews)} ${reviews === 1 ? 'review' : 'reviews'} given` : 'last 12 months';

const WEEKDAYS: string[] = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];

export const relativeTime = (iso: string, now: number): string => {
  const s: number = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86_400)} d ago`;
};

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [RadialCalendar, RhythmHeatmap, RepoStream, ChurnChart, LanguageBars, InsightsSection],
  templateUrl: './activity.html',
  styleUrl: './activity.scss',
})
export class Activity implements OnInit, OnDestroy {

  protected readonly data: ActivityDataService = inject(ActivityDataService);
  protected readonly DataSource: typeof DataSource = DataSource;
  protected readonly tableView: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly now: WritableSignal<number> = signal<number>(Date.now());
  protected readonly fmt: Intl.NumberFormat = whole;
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly snap: Signal<ActivitySnapshot | null> = this.data.snapshot;

  protected readonly privateShare: Signal<number> = computed((): number => {
    const s: ActivitySnapshot | null = this.snap();
    return s && s.totals.contributions > 0 ? s.totals.privateContributions / s.totals.contributions : 0;
  });

  protected readonly tiles: Signal<Tile[]> = computed((): Tile[] => {
    const s: ActivitySnapshot | null = this.snap();
    if (!s) return [];
    const t: ActivitySnapshot['totals'] = s.totals;
    return [
      { label: 'Public commits', value: whole.format(t.publicCommits), note: `across ${s.repos.length} public repositories` },
      { label: 'Lines added', value: compact.format(t.linesAdded), note: `${compact.format(t.linesDeleted)} deleted, public repos` },
      { label: 'Current streak', value: `${s.streak.current} days`, note: `longest ${s.streak.longest} days` },
      { label: 'Pull requests', value: whole.format(t.pullRequests), note: pullRequestNote(t.reviews) },
      ...IAC_KPI_TOOLS.map((tool: string): Tile => iacTile(tool, s.insights?.iac.tools ?? [])),
    ];
  });

  protected readonly busiestDay: Signal<string> = computed((): string => {
    const days: CalendarDay[] = this.snap()?.calendar ?? [];
    const top: CalendarDay | undefined = days.reduce<CalendarDay | undefined>(
      (best: CalendarDay | undefined, d: CalendarDay): CalendarDay | undefined => (!best || d.count > best.count ? d : best),
      undefined,
    );
    if (!top) return '';
    const activeDays: number = days.filter((d: CalendarDay): boolean => d.count > 0).length;
    const date: string = new Date(`${top.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
    return `Active on ${activeDays} of ${days.length} days. Busiest: ${date}, with ${whole.format(top.count)} contributions.`;
  });

  protected readonly peakRhythm: Signal<string> = computed((): string => {
    const grid: number[][] = this.snap()?.hourOfWeek ?? [];
    let best: { day: number; hour: number; count: number } = { day: 0, hour: 0, count: 0 };
    grid.forEach((row: number[], day: number): void =>
      row.forEach((count: number, hour: number): void => {
        if (count > best.count) best = { day, hour, count };
      }),
    );
    if (best.count === 0) return 'Commit times appear after the first scheduled refresh.';
    const weekend: number = (grid[5] ?? []).concat(grid[6] ?? []).reduce((a: number, b: number): number => a + b, 0);
    const total: number = grid.flat().reduce((a: number, b: number): number => a + b, 0);
    return `Most active on ${WEEKDAYS[best.day]} around ${hourLabel(best.hour)}. ${Math.round((weekend / total) * 100)}% of commits land on weekends.`;
  });

  protected readonly updated: Signal<string> = computed((): string => {
    const s: ActivitySnapshot | null = this.snap();
    return s ? relativeTime(s.generatedAt, this.now()) : '';
  });

  public ngOnInit(): void {
    void this.data.start();
    this.clockTimer = setInterval((): void => this.now.set(Date.now()), 30_000);
  }

  public ngOnDestroy(): void {
    this.data.stop();
    if (this.clockTimer) clearInterval(this.clockTimer);
  }

  protected ago(iso: string): string {
    return relativeTime(iso, this.now());
  }

  protected isFresh(event: LiveEvent): boolean {
    return this.data.freshIds().has(event.id);
  }
}

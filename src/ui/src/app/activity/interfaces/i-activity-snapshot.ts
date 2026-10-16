import type { ActivityTotals } from './i-activity-totals';
import type { CalendarDay } from './i-calendar-day';
import type { ChurnWeek } from './i-churn-week';
import type { Insights } from './i-insights';
import type { LanguageShare } from './i-language-share';
import type { RepoActivity } from './i-repo-activity';
import type { Streak } from './i-streak';

/** Mirrors ActivitySnapshotSchema in src/api/activity. */
export interface ActivitySnapshot {
  login: string;
  generatedAt: string;
  enrichedAt: string | null;
  timezone: string;
  range: { from: string; to: string };
  totals: ActivityTotals;
  streak: Streak;
  calendar: CalendarDay[];
  repos: RepoActivity[];
  languages: LanguageShare[];
  /** [weekday 0=Mon][hour 0-23] */
  hourOfWeek: number[][];
  churn: ChurnWeek[];
  /** Present once the API has run the insights refresh. */
  insights?: Insights;
}

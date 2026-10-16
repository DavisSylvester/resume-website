import { Type } from '@sinclair/typebox';
import { InsightsSchema } from './insights.schema.mjs';

/** One day on the contribution calendar. `count` includes private (restricted) work. */
export const CalendarDaySchema = Type.Object({
  date: Type.String(),
  count: Type.Integer({ minimum: 0 }),
});

export const WeekCountSchema = Type.Object({
  week: Type.String(),
  count: Type.Integer({ minimum: 0 }),
});

/** Commit activity for one PUBLIC repository. Private repos are never itemised. */
export const RepoActivitySchema = Type.Object({
  name: Type.String(),
  url: Type.String(),
  language: Type.Union([Type.String(), Type.Null()]),
  languageColor: Type.Union([Type.String(), Type.Null()]),
  commits: Type.Integer({ minimum: 0 }),
  /** Commits per week; `week` is the Monday (yyyy-mm-dd). */
  weekly: Type.Array(WeekCountSchema),
});

export const LanguageShareSchema = Type.Object({
  name: Type.String(),
  color: Type.Union([Type.String(), Type.Null()]),
  bytes: Type.Integer({ minimum: 0 }),
  commits: Type.Integer({ minimum: 0 }),
});

/** Code churn per week across public repos, from the contributor-stats endpoint. */
export const ChurnWeekSchema = Type.Object({
  week: Type.String(),
  additions: Type.Integer({ minimum: 0 }),
  deletions: Type.Integer({ minimum: 0 }),
});

export const ActivityTotalsSchema = Type.Object({
  contributions: Type.Integer({ minimum: 0 }),
  privateContributions: Type.Integer({ minimum: 0 }),
  publicCommits: Type.Integer({ minimum: 0 }),
  pullRequests: Type.Integer({ minimum: 0 }),
  reviews: Type.Integer({ minimum: 0 }),
  issues: Type.Integer({ minimum: 0 }),
  reposContributedTo: Type.Integer({ minimum: 0 }),
  linesAdded: Type.Integer({ minimum: 0 }),
  linesDeleted: Type.Integer({ minimum: 0 }),
});

export const StreakSchema = Type.Object({
  current: Type.Integer({ minimum: 0 }),
  longest: Type.Integer({ minimum: 0 }),
});

export const ActivitySnapshotSchema = Type.Object({
  login: Type.String(),
  generatedAt: Type.String(),
  /** When the slower REST enrichment (hour-of-week, churn) last ran. */
  enrichedAt: Type.Union([Type.String(), Type.Null()]),
  timezone: Type.String(),
  range: Type.Object({ from: Type.String(), to: Type.String() }),
  totals: ActivityTotalsSchema,
  streak: StreakSchema,
  calendar: Type.Array(CalendarDaySchema),
  repos: Type.Array(RepoActivitySchema),
  languages: Type.Array(LanguageShareSchema),
  /** 7 x 24 grid of public commits: [weekday 0=Mon][hour 0-23], in `timezone`. */
  hourOfWeek: Type.Array(Type.Array(Type.Integer({ minimum: 0 }))),
  churn: Type.Array(ChurnWeekSchema),
  insights: Type.Optional(InsightsSchema),
});

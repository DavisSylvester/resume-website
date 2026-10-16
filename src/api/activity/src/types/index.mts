import type { Static } from '@sinclair/typebox';
import type {
  ActivitySnapshotSchema,
  ActivityTotalsSchema,
  AppCredentialsSchema,
  CalendarDaySchema,
  ChurnWeekSchema,
  EnvSchema,
  LanguageShareSchema,
  LiveEventListSchema,
  LiveEventSchema,
  PushPayloadSchema,
  RepoActivitySchema,
  StreakSchema,
  WeekCountSchema,
  CareerYearSchema,
  InsightsSchema,
  InsightsMetaSchema,
  LedgerCommitSchema,
  PendingCommitSchema,
  PullRequestSummarySchema,
  PullRequestCountsSchema,
  RepoRunsSchema,
  RepoScanSchema,
} from '../schemas/index.mjs';

export type CalendarDay = Static<typeof CalendarDaySchema>;
export type WeekCount = Static<typeof WeekCountSchema>;
export type RepoActivity = Static<typeof RepoActivitySchema>;
export type LanguageShare = Static<typeof LanguageShareSchema>;
export type ChurnWeek = Static<typeof ChurnWeekSchema>;
export type ActivityTotals = Static<typeof ActivityTotalsSchema>;
export type Streak = Static<typeof StreakSchema>;
export type ActivitySnapshot = Static<typeof ActivitySnapshotSchema>;
export type LiveEvent = Static<typeof LiveEventSchema>;
export type LiveEventList = Static<typeof LiveEventListSchema>;
export type PushPayload = Static<typeof PushPayloadSchema>;
export type AppCredentials = Static<typeof AppCredentialsSchema>;
export type Env = Static<typeof EnvSchema>;
export type Insights = Static<typeof InsightsSchema>;
export type LedgerCommit = Static<typeof LedgerCommitSchema>;
export type RepoScan = Static<typeof RepoScanSchema>;
export type PendingCommit = Static<typeof PendingCommitSchema>;
export type RepoRuns = Static<typeof RepoRunsSchema>;
export type PullRequestSummary = Static<typeof PullRequestSummarySchema>;
export type CareerYear = Static<typeof CareerYearSchema>;
export type InsightsMeta = Static<typeof InsightsMetaSchema>;
export type PullRequestCounts = Static<typeof PullRequestCountsSchema>;

/** Recoverable-error result. Reserve `throw` for unexpected failures. */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T,>(value: T): Result<T, never> => ({ ok: true, value });
export const fail = <E,>(error: E): Result<never, E> => ({ ok: false, error });

export const RefreshDepth = {
  /** One GraphQL call: calendar, totals, repos. Used on every webhook. */
  Shallow: 'shallow',
  /** Shallow plus REST enrichment: hour-of-week and lines changed. Used on the schedule. */
  Deep: 'deep',
} as const;
export type RefreshDepth = (typeof RefreshDepth)[keyof typeof RefreshDepth];

export const WebhookOutcome = {
  Stored: 'stored',
  Ignored: 'ignored',
  Pong: 'pong',
} as const;
export type WebhookOutcome = (typeof WebhookOutcome)[keyof typeof WebhookOutcome];

import winston from 'winston';
import type { Logger } from 'winston';
import { ok } from '../src/types/index.mjs';
import type { CommitDetail, ContributionsResponse, InsightsSource, RepoTarget } from '../src/interfaces/index.mjs';
import type { ActivitySnapshot, Env, RepoScan, Result } from '../src/types/index.mjs';

/** A logger that writes nowhere, so test output stays clean. */
export const silentLogger = (): Logger =>
  winston.createLogger({ silent: true, transports: [new winston.transports.Console()] });

export const fixedClock = (iso: string): (() => Date) => (): Date => new Date(iso);

export const testEnv = (overrides: Partial<Env> = {}): Env => ({
  GITHUB_LOGIN: 'DavisSylvester',
  TABLE_NAME: 'test-table',
  ALLOWED_ORIGINS: 'https://www.dsylvester.io,http://localhost:4200',
  ACTIVITY_TIMEZONE: 'America/Chicago',
  LIVE_EVENT_TTL_DAYS: 30,
  REFRESH_DEBOUNCE_SECONDS: 60,
  LOG_LEVEL: 'error',
  ...overrides,
});

type Collection = NonNullable<ContributionsResponse['user']>['contributionsCollection'];

/** A small but realistic contributionsCollection: one public and one private repo. */
export const sampleCollection = (): Collection => ({
  startedAt: '2025-10-14T00:00:00Z',
  endedAt: '2026-10-14T00:00:00Z',
  restrictedContributionsCount: 900,
  totalCommitContributions: 40,
  totalPullRequestContributions: 5,
  totalPullRequestReviewContributions: 2,
  totalIssueContributions: 1,
  totalRepositoriesWithContributedCommits: 2,
  contributionCalendar: {
    totalContributions: 948,
    weeks: [
      {
        contributionDays: [
          { date: '2026-10-10', contributionCount: 0 },
          { date: '2026-10-11', contributionCount: 3 },
          { date: '2026-10-12', contributionCount: 5 },
          { date: '2026-10-13', contributionCount: 2 },
          { date: '2026-10-14', contributionCount: 0 },
        ],
      },
    ],
  },
  commitContributionsByRepository: [
    {
      repository: {
        nameWithOwner: 'DavisSylvester/public-repo',
        url: 'https://github.com/DavisSylvester/public-repo',
        isPrivate: false,
        primaryLanguage: { name: 'TypeScript', color: '#3178c6' },
        languages: { edges: [{ size: 900, node: { name: 'TypeScript', color: '#3178c6' } }, { size: 100, node: { name: 'SCSS', color: '#c6538c' } }] },
      },
      contributions: {
        totalCount: 30,
        nodes: [
          { occurredAt: '2026-10-12T07:00:00Z', commitCount: 20 },
          { occurredAt: '2026-10-05T07:00:00Z', commitCount: 10 },
        ],
      },
    },
    {
      repository: {
        nameWithOwner: 'DavisSylvester/top-secret',
        url: 'https://github.com/DavisSylvester/top-secret',
        isPrivate: true,
        primaryLanguage: { name: 'Dart', color: '#00B4AB' },
        languages: { edges: [{ size: 500, node: { name: 'Dart', color: '#00B4AB' } }] },
      },
      contributions: { totalCount: 10, nodes: [{ occurredAt: '2026-10-11T07:00:00Z', commitCount: 10 }] },
    },
  ],
});

export const sampleSnapshot = (generatedAt: string = '2026-10-14T12:00:00.000Z'): ActivitySnapshot => ({
  login: 'DavisSylvester',
  generatedAt,
  enrichedAt: null,
  timezone: 'America/Chicago',
  range: { from: '2025-10-14T00:00:00Z', to: '2026-10-14T00:00:00Z' },
  totals: {
    contributions: 948,
    privateContributions: 900,
    publicCommits: 40,
    pullRequests: 5,
    reviews: 2,
    issues: 1,
    reposContributedTo: 2,
    linesAdded: 0,
    linesDeleted: 0,
  },
  streak: { current: 3, longest: 3 },
  calendar: [{ date: '2026-10-14', count: 0 }],
  repos: [],
  languages: [],
  hourOfWeek: Array.from({ length: 7 }, (): number[] => Array.from({ length: 24 }, (): number => 0)),
  churn: [],
});

export interface FakeSourceOptions {
  targets?: RepoTarget[];
  scans?: Record<string, Partial<RepoScan>>;
  commits?: Record<string, { sha: string; date: string; isMerge?: boolean }[]>;
  details?: Record<string, CommitDetail>;
  rate?: number | null;
}

/** In-memory InsightsSource. Records every commit-detail fetch in `fetched`. */
export const fakeInsightsSource = (o: FakeSourceOptions = {}): InsightsSource & { fetched: string[]; scanned: string[] } => {
  const fetched: string[] = [];
  const scanned: string[] = [];
  return {
    fetched,
    scanned,
    repoTargets: async () => ok(o.targets ?? []),
    scanRepo: async (t: RepoTarget, nowIso: string): Promise<Result<RepoScan>> => {
      scanned.push(t.fullName);
      return ok({
        repo: t.fullName,
        isPrivate: t.isPrivate,
        pushedAt: t.pushedAt,
        scannedAt: nowIso,
        roots: { cdk: [], pulumi: [], cloudformation: [], serverless: [] },
        tools: [],
        frameworks: [],
        providers: [],
        clouds: [],
        testBytes: 0,
        codeBytes: 0,
        commitsListedUntil: null,
        ...(o.scans?.[t.fullName] ?? {}),
      });
    },
    listMyCommits: async (fullName: string) =>
      ok((o.commits?.[fullName] ?? []).map((c) => ({ sha: c.sha, date: c.date, isMerge: c.isMerge ?? false }))),
    commitDetail: async (_fullName: string, sha: string): Promise<Result<CommitDetail | null>> => {
      fetched.push(sha);
      return ok(o.details?.[sha] ?? null);
    },
    pullRequests: async () => ok({ items: [], counts: { opened: 0, merged: 0, monthly: {} }, includePrivate: true }),
    workflowRuns: async (t: RepoTarget, _from: string, nowIso: string) =>
      ok({ repo: t.fullName, isPrivate: t.isPrivate, fetchedAt: nowIso, weekly: {}, denied: false }),
    career: async () => ok({ joinedYear: 2015, years: [] }),
    rateRemaining: () => o.rate ?? null,
  };
};

import winston from 'winston';
import type { Logger } from 'winston';
import type { ContributionsResponse } from '../src/interfaces/index.mjs';
import type { ActivitySnapshot, Env } from '../src/types/index.mjs';

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

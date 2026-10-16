import { describe, expect, test } from 'bun:test';
import { aggregateInsights, median, monthSpan } from '../src/services/insights/aggregate.mjs';
import type { AggregateInput } from '../src/services/insights/aggregate.mjs';
import type { LedgerCommit, RepoScan } from '../src/types/index.mjs';

const commit = (sha: string, date: string, lines: LedgerCommit['lines'], extra: Partial<LedgerCommit> = {}): LedgerCommit => ({
  sha,
  repo: 'o/a',
  isPrivate: false,
  date,
  type: 'feat',
  isMerge: false,
  lines,
  ...extra,
});

const scan = (repo: string, extra: Partial<RepoScan> = {}): RepoScan => ({
  repo,
  isPrivate: false,
  pushedAt: '2026-09-01T00:00:00Z',
  scannedAt: '2026-10-01T00:00:00Z',
  roots: { cdk: [], pulumi: [], cloudformation: [], serverless: [] },
  tools: [],
  frameworks: [],
  providers: [],
  clouds: [],
  testBytes: 0,
  codeBytes: 0,
  commitsListedUntil: null,
  ...extra,
});

const base = (over: Partial<AggregateInput> = {}): AggregateInput => ({
  now: new Date('2026-10-15T00:00:00Z'),
  windowFrom: new Date('2026-08-15T00:00:00Z'),
  ledger: [],
  scans: [],
  pendingCount: 0,
  pullRequests: [],
  reviews: 0,
  pullRequestsIncludePrivate: true,
  runs: [],
  actionsIncludePrivate: true,
  career: { joinedYear: 2015, years: [] },
  ...over,
});

describe('helpers', () => {
  test('monthSpan is inclusive and crosses years', () => {
    expect(monthSpan(new Date('2025-11-20T00:00:00Z'), new Date('2026-02-01T00:00:00Z'))).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  test('median handles even, odd and empty', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('aggregateInsights', () => {
  const ledger: LedgerCommit[] = [
    commit('1', '2026-09-02T00:00:00Z', { terraform: { add: 100, del: 10, files: 3 }, test: { add: 5, del: 0, files: 1 } }),
    commit('2', '2026-09-20T00:00:00Z', { cdk: { add: 40, del: 4, files: 2 } }, { repo: 'private:9', isPrivate: true, type: 'fix' }),
    commit('3', '2026-10-05T00:00:00Z', { terraform: { add: 1, del: 1, files: 1 }, source: { add: 20, del: 2, files: 2 } }, { repo: 'o/b' }),
    commit('4', '2026-10-06T00:00:00Z', { source: { add: 9, del: 0, files: 1 } }, { isMerge: true, type: 'merge' }),
    commit('old', '2026-01-01T00:00:00Z', { terraform: { add: 999, del: 0, files: 1 } }),
  ];
  const scans: RepoScan[] = [
    scan('o/a', { tools: ['terraform'], providers: ['aws', 'auth0'], clouds: ['AWS'], frameworks: [{ name: 'Elysia', category: 'Backend' }], testBytes: 10, codeBytes: 90 }),
    scan('o/b', { tools: ['terraform', 'cdk'], providers: ['azurerm'], clouds: ['AWS', 'Azure'], frameworks: [{ name: 'Elysia', category: 'Backend' }, { name: 'Angular', category: 'Frontend' }], codeBytes: 50 }),
  ];
  const out = aggregateInsights(base({ ledger, scans, pendingCount: 7 }));

  test('IaC tools: commits, lines, repos touched and present; window applied', () => {
    expect(out.iac.tools).toEqual([
      { tool: 'terraform', commits: 2, linesAdded: 101, linesDeleted: 11, reposTouched: 2, reposPresent: 2 },
      { tool: 'cdk', commits: 1, linesAdded: 40, linesDeleted: 4, reposTouched: 1, reposPresent: 1 },
    ]);
  });

  test('IaC monthly counts per tool for every month in the window', () => {
    expect(out.iac.monthly).toEqual([
      { month: '2026-08', values: { terraform: 0, cdk: 0 } },
      { month: '2026-09', values: { terraform: 1, cdk: 1 } },
      { month: '2026-10', values: { terraform: 1, cdk: 0 } },
    ]);
  });

  test('clouds and providers count repositories', () => {
    expect(out.iac.clouds).toEqual([
      { cloud: 'AWS', repos: 2 },
      { cloud: 'Azure', repos: 1 },
    ]);
    expect(out.iac.providers.map((p) => p.name)).toEqual(['auth0', 'aws', 'azurerm']);
  });

  test('stack counts repositories per framework, most used first', () => {
    expect(out.stack).toEqual([
      { name: 'Elysia', category: 'Backend', repos: 2 },
      { name: 'Angular', category: 'Frontend', repos: 1 },
    ]);
  });

  test('commit types and testing exclude nothing but merges from testing', () => {
    expect(out.commitTypes).toEqual([
      { type: 'feat', count: 2 },
      { type: 'fix', count: 1 },
      { type: 'merge', count: 1 },
    ]);
    expect(out.testing.commitsTotal).toBe(3);
    expect(out.testing.commitsTouchingTests).toBe(1);
    expect(out.testing.testLinesAdded).toBe(5);
    expect(out.testing.codeLinesAdded).toBe(100 + 40 + 1 + 20);
    expect(out.testing.reposWithTests).toBe(1);
  });

  test('coverage reports analyzed and pending commits', () => {
    expect(out.coverage).toMatchObject({ commitsAnalyzed: 4, commitsPending: 7, reposScanned: 2 });
  });

  test('pull requests: opened, merged, median hours, monthly', () => {
    const pr = aggregateInsights(
      base({
        reviews: 3,
        pullRequests: [
          { createdAt: '2026-09-01T00:00:00Z', mergedAt: '2026-09-01T10:00:00Z', isPrivate: false },
          { createdAt: '2026-09-02T00:00:00Z', mergedAt: '2026-09-03T00:00:00Z', isPrivate: true },
          { createdAt: '2026-10-01T00:00:00Z', mergedAt: null, isPrivate: false },
          { createdAt: '2025-01-01T00:00:00Z', mergedAt: '2025-01-02T00:00:00Z', isPrivate: false },
        ],
      }),
    ).pullRequests;
    expect(pr.opened).toBe(3);
    expect(pr.merged).toBe(2);
    expect(pr.medianHoursToMerge).toBe(17);
    expect(pr.reviews).toBe(3);
    expect(pr.monthly.find((m) => m.month === '2026-09')?.values).toEqual({ opened: 2, merged: 2 });
  });

  test('CI/CD sums weekly runs across repos inside the window', () => {
    const ci = aggregateInsights(
      base({
        runs: [
          { repo: 'o/a', isPrivate: false, fetchedAt: 'x', denied: false, weekly: { '2026-09-07': { succeeded: 4, failed: 1, other: 1, deploys: 2 }, '2025-01-06': { succeeded: 50, failed: 0, other: 0, deploys: 0 } } },
          { repo: 'o/b', isPrivate: false, fetchedAt: 'x', denied: false, weekly: { '2026-09-07': { succeeded: 1, failed: 0, other: 0, deploys: 1 } } },
          { repo: 'o/c', isPrivate: true, fetchedAt: 'x', denied: true, weekly: {} },
        ],
      }),
    ).cicd;
    expect(ci).toEqual({
      runs: 7,
      succeeded: 5,
      failed: 1,
      deploys: 3,
      reposWithRuns: 2,
      weekly: [{ week: '2026-09-07', values: { succeeded: 5, failed: 1, other: 1, deploys: 3 } }],
    });
  });

  test('career years are sorted', () => {
    const c = aggregateInsights(
      base({
        career: {
          joinedYear: 2015,
          years: [
            { year: 2026, contributions: 10, privateContributions: 5, commits: 3, pullRequests: 1 },
            { year: 2015, contributions: 1, privateContributions: 0, commits: 1, pullRequests: 0 },
          ],
        },
      }),
    ).career;
    expect(c.years.map((y) => y.year)).toEqual([2015, 2026]);
  });
});

describe('pull request exact counts', () => {
  test('exact totals and monthly counts win over the capped sample', () => {
    const pr = aggregateInsights(
      base({
        pullRequests: [{ createdAt: '2026-09-01T00:00:00Z', mergedAt: '2026-09-01T01:00:00Z', isPrivate: false }],
        pullRequestCounts: { opened: 1749, merged: 1673, monthly: { '2026-09': { opened: 900, merged: 870 } } },
      }),
    ).pullRequests;
    expect(pr.opened).toBe(1749);
    expect(pr.merged).toBe(1673);
    expect(pr.medianHoursToMerge).toBe(1);
    expect(pr.monthly.find((m) => m.month === '2026-09')?.values).toEqual({ opened: 900, merged: 870 });
  });
});

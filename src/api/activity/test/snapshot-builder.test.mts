import { describe, expect, test } from 'bun:test';
import {
  applyEnrichment,
  buildSnapshot,
  computeStreak,
  hourOfWeek,
  mergeChurn,
  toLanguages,
  weekStart,
} from '../src/services/snapshot-builder.mjs';
import type { ActivitySnapshot } from '../src/types/index.mjs';
import { sampleCollection, sampleSnapshot } from './helpers.mjs';

describe('weekStart', () => {
  test('returns the Monday of the week', () => {
    expect(weekStart('2026-10-14')).toBe('2026-10-12'); // Wednesday
    expect(weekStart('2026-10-12T23:00:00Z')).toBe('2026-10-12'); // Monday itself
    expect(weekStart('2026-10-18')).toBe('2026-10-12'); // Sunday belongs to the prior Monday
  });
});

describe('computeStreak', () => {
  test('a zero on the final day (today in progress) does not break the current streak', () => {
    const streak = computeStreak([
      { date: 'a', count: 1 },
      { date: 'b', count: 0 },
      { date: 'c', count: 2 },
      { date: 'd', count: 4 },
      { date: 'e', count: 0 },
    ]);
    expect(streak).toEqual({ current: 2, longest: 2 });
  });

  test('longest is tracked independently of current', () => {
    const streak = computeStreak([
      { date: 'a', count: 1 },
      { date: 'b', count: 1 },
      { date: 'c', count: 1 },
      { date: 'd', count: 0 },
      { date: 'e', count: 0 },
    ]);
    expect(streak).toEqual({ current: 0, longest: 3 });
  });

  test('empty calendar', () => {
    expect(computeStreak([])).toEqual({ current: 0, longest: 0 });
  });
});

describe('hourOfWeek', () => {
  test('buckets in the configured timezone, Monday first', () => {
    // 2026-10-14T03:30Z is Tuesday 22:30 in Chicago (CDT, UTC-5).
    const grid = hourOfWeek(['2026-10-14T03:30:00Z', 'not-a-date'], 'America/Chicago');
    expect(grid[1]?.[22]).toBe(1);
    expect(grid.flat().reduce((a: number, b: number): number => a + b, 0)).toBe(1);
  });
});

describe('buildSnapshot', () => {
  const snapshot: ActivitySnapshot = buildSnapshot({
    login: 'DavisSylvester',
    timezone: 'America/Chicago',
    now: new Date('2026-10-14T12:00:00Z'),
    collection: sampleCollection(),
    previous: null,
  });

  test('headline totals include private contributions', () => {
    expect(snapshot.totals.contributions).toBe(948);
  });

  test('private = restricted count + commits in private repos the App can see', () => {
    expect(snapshot.totals.privateContributions).toBe(900 + 10);
  });

  test('public commits count only public repositories', () => {
    expect(snapshot.totals.publicCommits).toBe(30);
  });

  test('never itemises a private repository', () => {
    expect(snapshot.repos.map((r) => r.name)).toEqual(['DavisSylvester/public-repo']);
    expect(JSON.stringify(snapshot)).not.toContain('top-secret');
  });

  test('groups repo commits by ISO week', () => {
    expect(snapshot.repos[0]?.weekly).toEqual([
      { week: '2026-10-05', count: 10 },
      { week: '2026-10-12', count: 20 },
    ]);
  });

  test('carries enrichment forward from the previous snapshot', () => {
    const previous: ActivitySnapshot = { ...sampleSnapshot(), enrichedAt: '2026-10-13T00:00:00Z', churn: [{ week: '2026-10-05', additions: 5, deletions: 1 }] };
    previous.totals.linesAdded = 5;
    const next = buildSnapshot({
      login: 'DavisSylvester',
      timezone: 'America/Chicago',
      now: new Date('2026-10-14T12:00:00Z'),
      collection: sampleCollection(),
      previous,
    });
    expect(next.enrichedAt).toBe('2026-10-13T00:00:00Z');
    expect(next.churn).toHaveLength(1);
    expect(next.totals.linesAdded).toBe(5);
  });
});

describe('toLanguages', () => {
  test('splits each repo commits across its languages by byte share, private included', () => {
    const langs = toLanguages(sampleCollection().commitContributionsByRepository);
    expect(langs).toEqual([
      { name: 'TypeScript', color: '#3178c6', bytes: 900, commits: 27 },
      { name: 'Dart', color: '#00B4AB', bytes: 500, commits: 10 },
      { name: 'SCSS', color: '#c6538c', bytes: 100, commits: 3 },
    ]);
  });
});

describe('mergeChurn and applyEnrichment', () => {
  const monday: number = Date.parse('2026-10-12T00:00:00Z') / 1000;
  const old: number = Date.parse('2024-01-01T00:00:00Z') / 1000;

  test('sums repos per week and drops weeks outside the window', () => {
    const churn = mergeChurn(
      [
        [{ w: monday, a: 10, d: 2, c: 1 }, { w: old, a: 999, d: 999, c: 9 }],
        [{ w: monday, a: 5, d: 1, c: 1 }],
      ],
      '2025-10-14T00:00:00Z',
    );
    expect(churn).toEqual([{ week: '2026-10-12', additions: 15, deletions: 3 }]);
  });

  test('null churn (stats still computing) keeps the existing churn', () => {
    const base: ActivitySnapshot = { ...sampleSnapshot(), churn: [{ week: '2026-10-05', additions: 7, deletions: 3 }] };
    const out = applyEnrichment(base, { commitTimestamps: [], churn: null, now: new Date('2026-10-14T12:00:00Z') });
    expect(out.totals.linesAdded).toBe(7);
    expect(out.totals.linesDeleted).toBe(3);
    expect(out.enrichedAt).toBe('2026-10-14T12:00:00.000Z');
  });
});

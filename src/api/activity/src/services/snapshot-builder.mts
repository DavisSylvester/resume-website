import type { ContributionsResponse } from '../interfaces/index.mjs';
import type {
  ActivitySnapshot,
  CalendarDay,
  ChurnWeek,
  LanguageShare,
  RepoActivity,
  Streak,
  WeekCount,
} from '../types/index.mjs';

/**
 * Pure functions that shape GitHub responses into an ActivitySnapshot.
 * No I/O lives here, so every rule is unit-tested directly.
 */

const DAY_MS: number = 24 * 60 * 60 * 1000;

type Collection = NonNullable<ContributionsResponse['user']>['contributionsCollection'];
type RepoContribution = Collection['commitContributionsByRepository'][number];

/** Monday of the UTC week that contains `isoDate` (yyyy-mm-dd or full ISO). */
export const weekStart = (isoDate: string): string => {
  const d: Date = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  const offset: number = (d.getUTCDay() + 6) % 7; // 0 = Monday
  return new Date(d.getTime() - offset * DAY_MS).toISOString().slice(0, 10);
};

/**
 * Current streak counts back from the last calendar day. A zero on the last day does not
 * break it, because "today" is still in progress.
 */
export const computeStreak = (calendar: CalendarDay[]): Streak => {
  let longest: number = 0;
  let run: number = 0;
  for (const day of calendar) {
    run = day.count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let current: number = 0;
  let i: number = calendar.length - 1;
  if (i >= 0 && (calendar[i]?.count ?? 0) === 0) i -= 1;
  while (i >= 0 && (calendar[i]?.count ?? 0) > 0) {
    current += 1;
    i -= 1;
  }
  return { current, longest };
};

export const emptyHourGrid = (): number[][] =>
  Array.from({ length: 7 }, (): number[] => Array.from({ length: 24 }, (): number => 0));

const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** Buckets commit timestamps into a [weekday][hour] grid in the given IANA timezone. */
export const hourOfWeek = (timestamps: string[], timezone: string): number[][] => {
  const grid: number[][] = emptyHourGrid();
  const fmt: Intl.DateTimeFormat = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  });
  for (const ts of timestamps) {
    const time: number = Date.parse(ts);
    if (Number.isNaN(time)) continue;
    const parts: Intl.DateTimeFormatPart[] = fmt.formatToParts(new Date(time));
    const weekday: string = parts.find((p: Intl.DateTimeFormatPart): boolean => p.type === 'weekday')?.value ?? '';
    const hour: number = Number(parts.find((p: Intl.DateTimeFormatPart): boolean => p.type === 'hour')?.value);
    const row: number[] | undefined = grid[WEEKDAY_INDEX[weekday] ?? -1];
    if (row && hour >= 0 && hour < 24) row[hour] = (row[hour] ?? 0) + 1;
  }
  return grid;
};

const toWeekly = (nodes: { occurredAt: string; commitCount: number }[]): WeekCount[] => {
  const byWeek: Map<string, number> = new Map();
  for (const node of nodes) {
    const key: string = weekStart(node.occurredAt);
    byWeek.set(key, (byWeek.get(key) ?? 0) + node.commitCount);
  }
  return [...byWeek.entries()]
    .map(([week, count]: [string, number]): WeekCount => ({ week, count }))
    .sort((a: WeekCount, b: WeekCount): number => a.week.localeCompare(b.week));
};

/** Public repos only. Private repos never leave the API with a name attached. */
export const toPublicRepos = (repos: RepoContribution[]): RepoActivity[] =>
  repos
    .filter((r: RepoContribution): boolean => !r.repository.isPrivate)
    .map((r: RepoContribution): RepoActivity => ({
      name: r.repository.nameWithOwner,
      url: r.repository.url,
      language: r.repository.primaryLanguage?.name ?? null,
      languageColor: r.repository.primaryLanguage?.color ?? null,
      commits: r.contributions.totalCount,
      weekly: toWeekly(r.contributions.nodes),
    }))
    .sort((a: RepoActivity, b: RepoActivity): number => b.commits - a.commits);

/**
 * Language mix across every repo the App can see, private included. Only language names
 * and totals are exposed, so no private repository is identifiable.
 */
export const toLanguages = (repos: RepoContribution[]): LanguageShare[] => {
  const byName: Map<string, LanguageShare> = new Map();
  for (const r of repos) {
    const edges: { size: number; node: { name: string; color: string | null } }[] = r.repository.languages.edges;
    const repoBytes: number = edges.reduce((sum: number, e: { size: number }): number => sum + e.size, 0);
    for (const edge of edges) {
      const share: LanguageShare = byName.get(edge.node.name) ?? {
        name: edge.node.name,
        color: edge.node.color,
        bytes: 0,
        commits: 0,
      };
      share.bytes += edge.size;
      // Attribute the repo's commits to languages by their byte share.
      share.commits += repoBytes > 0 ? Math.round((r.contributions.totalCount * edge.size) / repoBytes) : 0;
      byName.set(edge.node.name, share);
    }
  }
  return [...byName.values()]
    .filter((l: LanguageShare): boolean => l.commits > 0)
    .sort((a: LanguageShare, b: LanguageShare): number => b.commits - a.commits);
};

export interface BuildInput {
  login: string;
  timezone: string;
  now: Date;
  collection: Collection;
  previous: ActivitySnapshot | null;
}

/** Builds the GraphQL-derived part; carries enrichment forward from `previous`. */
export const buildSnapshot = (input: BuildInput): ActivitySnapshot => {
  const c: Collection = input.collection;
  const calendar: CalendarDay[] = c.contributionCalendar.weeks.flatMap(
    (w: { contributionDays: { date: string; contributionCount: number }[] }): CalendarDay[] =>
      w.contributionDays.map(
        (d: { date: string; contributionCount: number }): CalendarDay => ({ date: d.date, count: d.contributionCount }),
      ),
  );
  const prev: ActivitySnapshot | null = input.previous;
  const carried: Pick<ActivitySnapshot, 'insights'> = prev?.insights ? { insights: prev.insights } : {};
  const repos: RepoContribution[] = c.commitContributionsByRepository;
  const commitsWhere = (isPrivate: boolean): number =>
    repos
      .filter((r: RepoContribution): boolean => r.repository.isPrivate === isPrivate)
      .reduce((sum: number, r: RepoContribution): number => sum + r.contributions.totalCount, 0);
  return {
    login: input.login,
    generatedAt: input.now.toISOString(),
    enrichedAt: prev?.enrichedAt ?? null,
    timezone: input.timezone,
    range: { from: c.startedAt, to: c.endedAt },
    totals: {
      contributions: c.contributionCalendar.totalContributions,
      // Private work = contributions GitHub hides from this token (restricted) plus commits
      // in private repos the App can see. The App sees my own private repos, so GitHub
      // reports those as visible commits rather than restricted ones.
      privateContributions: c.restrictedContributionsCount + commitsWhere(true),
      publicCommits: commitsWhere(false),
      pullRequests: c.totalPullRequestContributions,
      reviews: c.totalPullRequestReviewContributions,
      issues: c.totalIssueContributions,
      reposContributedTo: c.totalRepositoriesWithContributedCommits,
      linesAdded: prev?.totals.linesAdded ?? 0,
      linesDeleted: prev?.totals.linesDeleted ?? 0,
    },
    streak: computeStreak(calendar),
    calendar,
    repos: toPublicRepos(c.commitContributionsByRepository),
    languages: toLanguages(c.commitContributionsByRepository),
    hourOfWeek: prev?.hourOfWeek ?? emptyHourGrid(),
    churn: prev?.churn ?? [],
    ...carried,
  };
};

export interface ContributorWeek {
  w: number;
  a: number;
  d: number;
  c: number;
}

/** Sums per-repo contributor-stats weeks into one churn series inside the snapshot window. */
export const mergeChurn = (series: ContributorWeek[][], fromIso: string): ChurnWeek[] => {
  const from: number = Date.parse(fromIso) - 7 * DAY_MS;
  const byWeek: Map<string, ChurnWeek> = new Map();
  for (const weeks of series) {
    for (const wk of weeks) {
      const ms: number = wk.w * 1000;
      if (ms < from || (wk.a === 0 && wk.d === 0)) continue;
      const key: string = weekStart(new Date(ms).toISOString());
      const row: ChurnWeek = byWeek.get(key) ?? { week: key, additions: 0, deletions: 0 };
      row.additions += wk.a;
      row.deletions += wk.d;
      byWeek.set(key, row);
    }
  }
  return [...byWeek.values()].sort((a: ChurnWeek, b: ChurnWeek): number => a.week.localeCompare(b.week));
};

export interface Enrichment {
  commitTimestamps: string[];
  churn: ChurnWeek[] | null;
  now: Date;
}

/** Applies REST enrichment. A null churn (stats still computing) keeps the previous churn. */
export const applyEnrichment = (snapshot: ActivitySnapshot, e: Enrichment): ActivitySnapshot => {
  const churn: ChurnWeek[] = e.churn ?? snapshot.churn;
  return {
    ...snapshot,
    enrichedAt: e.now.toISOString(),
    hourOfWeek: hourOfWeek(e.commitTimestamps, snapshot.timezone),
    churn,
    totals: {
      ...snapshot.totals,
      linesAdded: churn.reduce((sum: number, w: ChurnWeek): number => sum + w.additions, 0),
      linesDeleted: churn.reduce((sum: number, w: ChurnWeek): number => sum + w.deletions, 0),
    },
  };
};

import { IAC_TOOLS } from './classify.mjs';
import type { CareerYear, Insights, LedgerCommit, PullRequestCounts, PullRequestSummary, RepoRuns, RepoScan } from '../../types/index.mjs';

/** Pure aggregation of the ledger and cached scans into the snapshot's `insights` section. */

export interface AggregateInput {
  now: Date;
  windowFrom: Date;
  ledger: LedgerCommit[];
  scans: RepoScan[];
  pendingCount: number;
  /** A sample (search lists cap at 1,000); used for the median. */
  pullRequests: PullRequestSummary[];
  /** Exact totals and monthly counts; preferred over the sample when present. */
  pullRequestCounts?: PullRequestCounts | null;
  reviews: number;
  pullRequestsIncludePrivate: boolean;
  runs: RepoRuns[];
  actionsIncludePrivate: boolean;
  career: { joinedYear: number | null; years: CareerYear[] };
}

const DAY_MS: number = 86_400_000;

export const monthKey = (iso: string): string => iso.slice(0, 7);

/** Every yyyy-mm from `from` through `to`, inclusive. */
export const monthSpan = (from: Date, to: Date): string[] => {
  const out: string[] = [];
  let y: number = from.getUTCFullYear();
  let m: number = from.getUTCMonth();
  while (y < to.getUTCFullYear() || (y === to.getUTCFullYear() && m <= to.getUTCMonth())) {
    out.push(`${y}-${String(m + 1).padStart(2, '0')}`);
    m += 1;
    if (m === 12) {
      m = 0;
      y += 1;
    }
  }
  return out;
};

export const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s: number[] = [...xs].sort((a: number, b: number): number => a - b);
  const mid: number = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] ?? null) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
};

const countBy = (items: string[]): Map<string, number> => {
  const m: Map<string, number> = new Map();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return m;
};

/** Sort by a count descending, then by label ascending so ties are stable. */
const byCountDesc =
  <T,>(count: (x: T) => number, label: (x: T) => string) =>
  (a: T, b: T): number =>
    count(b) - count(a) || label(a).localeCompare(label(b));

export const aggregateInsights = (input: AggregateInput): Insights => {
  const from: string = input.windowFrom.toISOString();
  const ledger: LedgerCommit[] = input.ledger.filter((c: LedgerCommit): boolean => c.date >= from);
  const months: string[] = monthSpan(input.windowFrom, input.now);

  // Infrastructure as code
  const tools: Insights['iac']['tools'] = IAC_TOOLS.map((tool: string): Insights['iac']['tools'][number] => {
    const touching: LedgerCommit[] = ledger.filter((c: LedgerCommit): boolean => (c.lines[tool]?.files ?? 0) > 0);
    return {
      tool,
      commits: touching.length,
      linesAdded: touching.reduce((s: number, c: LedgerCommit): number => s + (c.lines[tool]?.add ?? 0), 0),
      linesDeleted: touching.reduce((s: number, c: LedgerCommit): number => s + (c.lines[tool]?.del ?? 0), 0),
      reposTouched: new Set(touching.map((c: LedgerCommit): string => c.repo)).size,
      reposPresent: input.scans.filter((s: RepoScan): boolean => s.tools.includes(tool)).length,
    };
  })
    .filter((t: Insights['iac']['tools'][number]): boolean => t.commits > 0 || t.reposPresent > 0)
    .sort((a: Insights['iac']['tools'][number], b: Insights['iac']['tools'][number]): number => b.commits - a.commits || b.reposPresent - a.reposPresent);

  const shownTools: string[] = tools.map((t: Insights['iac']['tools'][number]): string => t.tool);
  const monthly: Insights['iac']['monthly'] = months.map((month: string): Insights['iac']['monthly'][number] => {
    const values: Record<string, number> = {};
    for (const tool of shownTools) {
      values[tool] = ledger.filter((c: LedgerCommit): boolean => monthKey(c.date) === month && (c.lines[tool]?.files ?? 0) > 0).length;
    }
    return { month, values };
  });

  const clouds: Insights['iac']['clouds'] = [...countBy(input.scans.flatMap((s: RepoScan): string[] => s.clouds)).entries()]
    .map(([cloud, repos]: [string, number]): { cloud: string; repos: number } => ({ cloud, repos }))
    .sort((a: { cloud: string; repos: number }, b: { cloud: string; repos: number }): number => b.repos - a.repos || a.cloud.localeCompare(b.cloud));
  const providers: Insights['iac']['providers'] = [...countBy(input.scans.flatMap((s: RepoScan): string[] => s.providers)).entries()]
    .map(([name, repos]: [string, number]): { name: string; repos: number } => ({ name, repos }))
    .sort(byCountDesc((p: { name: string; repos: number }): number => p.repos, (p: { name: string }): string => p.name));

  // Stack fingerprint
  const fw: Map<string, { name: string; category: string; repos: number }> = new Map();
  for (const scan of input.scans) {
    for (const f of scan.frameworks) {
      const row: { name: string; category: string; repos: number } = fw.get(f.name) ?? { name: f.name, category: f.category, repos: 0 };
      row.repos += 1;
      fw.set(f.name, row);
    }
  }
  const stack: Insights['stack'] = [...fw.values()].sort(
    byCountDesc((r: { name: string; repos: number }): number => r.repos, (r: { name: string }): string => r.name),
  );

  // Commit types
  const commitTypes: Insights['commitTypes'] = [...countBy(ledger.map((c: LedgerCommit): string => c.type)).entries()]
    .map(([type, count]: [string, number]): { type: string; count: number } => ({ type, count }))
    .sort(byCountDesc((t: { type: string; count: number }): number => t.count, (t: { type: string }): string => t.type));

  // Testing
  const nonMerge: LedgerCommit[] = ledger.filter((c: LedgerCommit): boolean => !c.isMerge);
  const sumAdd = (cls: string[]): number =>
    nonMerge.reduce((s: number, c: LedgerCommit): number => s + cls.reduce((t: number, k: string): number => t + (c.lines[k]?.add ?? 0), 0), 0);
  const testing: Insights['testing'] = {
    commitsTotal: nonMerge.length,
    commitsTouchingTests: nonMerge.filter((c: LedgerCommit): boolean => (c.lines['test']?.files ?? 0) > 0).length,
    testLinesAdded: sumAdd(['test']),
    codeLinesAdded: sumAdd(['source', ...IAC_TOOLS]),
    reposWithTests: input.scans.filter((s: RepoScan): boolean => s.testBytes > 0).length,
    reposScanned: input.scans.length,
    testBytes: input.scans.reduce((s: number, r: RepoScan): number => s + r.testBytes, 0),
    codeBytes: input.scans.reduce((s: number, r: RepoScan): number => s + r.codeBytes, 0),
  };

  // Pull requests
  const prs: PullRequestSummary[] = input.pullRequests.filter((p: PullRequestSummary): boolean => p.createdAt >= from);
  const merged: PullRequestSummary[] = prs.filter((p: PullRequestSummary): boolean => p.mergedAt !== null);
  const hours: number[] = merged.map((p: PullRequestSummary): number => (Date.parse(p.mergedAt ?? '') - Date.parse(p.createdAt)) / 3_600_000);
  const med: number | null = median(hours);
  const exact: PullRequestCounts | null = input.pullRequestCounts ?? null;
  const pullRequests: Insights['pullRequests'] = {
    opened: exact?.opened ?? prs.length,
    merged: exact?.merged ?? merged.length,
    medianHoursToMerge: med === null ? null : Math.round(med * 10) / 10,
    reviews: input.reviews,
    monthly: months.map((month: string): Insights['pullRequests']['monthly'][number] => ({
      month,
      values: exact?.monthly[month] ?? {
        opened: prs.filter((p: PullRequestSummary): boolean => monthKey(p.createdAt) === month).length,
        merged: merged.filter((p: PullRequestSummary): boolean => monthKey(p.mergedAt ?? '') === month).length,
      },
    })),
  };

  // CI/CD
  const weekly: Map<string, Record<string, number>> = new Map();
  const windowStartWeek: string = new Date(input.windowFrom.getTime() - 7 * DAY_MS).toISOString().slice(0, 10);
  let reposWithRuns: number = 0;
  for (const r of input.runs) {
    let any: boolean = false;
    for (const [week, c] of Object.entries(r.weekly)) {
      if (week < windowStartWeek) continue;
      const row: Record<string, number> = weekly.get(week) ?? { succeeded: 0, failed: 0, other: 0, deploys: 0 };
      row['succeeded'] = (row['succeeded'] ?? 0) + c.succeeded;
      row['failed'] = (row['failed'] ?? 0) + c.failed;
      row['other'] = (row['other'] ?? 0) + c.other;
      row['deploys'] = (row['deploys'] ?? 0) + c.deploys;
      weekly.set(week, row);
      if (c.succeeded + c.failed + c.other > 0) any = true;
    }
    if (any) reposWithRuns += 1;
  }
  const weeks: { week: string; values: Record<string, number> }[] = [...weekly.entries()]
    .map(([week, values]: [string, Record<string, number>]): { week: string; values: Record<string, number> } => ({ week, values }))
    .sort((a: { week: string }, b: { week: string }): number => a.week.localeCompare(b.week));
  const total = (k: string): number => weeks.reduce((s: number, w: { values: Record<string, number> }): number => s + (w.values[k] ?? 0), 0);
  const cicd: Insights['cicd'] = {
    runs: total('succeeded') + total('failed') + total('other'),
    succeeded: total('succeeded'),
    failed: total('failed'),
    deploys: total('deploys'),
    reposWithRuns,
    weekly: weeks,
  };

  return {
    generatedAt: input.now.toISOString(),
    coverage: {
      commitsAnalyzed: ledger.length,
      commitsPending: input.pendingCount,
      reposScanned: input.scans.length,
      pullRequestsIncludePrivate: input.pullRequestsIncludePrivate,
      actionsIncludePrivate: input.actionsIncludePrivate,
    },
    iac: { tools, monthly, clouds, providers },
    stack,
    commitTypes,
    testing,
    pullRequests,
    cicd,
    career: {
      joinedYear: input.career.joinedYear,
      years: [...input.career.years].sort((a: CareerYear, b: CareerYear): number => a.year - b.year),
    },
  };
};

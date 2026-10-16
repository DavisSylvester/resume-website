import type { CareerYear } from './i-career-year';
import type { IacToolStat } from './i-iac-tool-stat';
import type { MonthValues } from './i-month-values';

/** Mirrors InsightsSchema in src/api/activity. */
export interface Insights {
  generatedAt: string;
  coverage: {
    commitsAnalyzed: number;
    commitsPending: number;
    reposScanned: number;
    pullRequestsIncludePrivate: boolean;
    actionsIncludePrivate: boolean;
  };
  iac: {
    tools: IacToolStat[];
    monthly: MonthValues[];
    clouds: { cloud: string; repos: number }[];
    providers: { name: string; repos: number }[];
  };
  stack: { name: string; category: string; repos: number }[];
  commitTypes: { type: string; count: number }[];
  testing: {
    commitsTotal: number;
    commitsTouchingTests: number;
    testLinesAdded: number;
    codeLinesAdded: number;
    reposWithTests: number;
    reposScanned: number;
    testBytes: number;
    codeBytes: number;
  };
  pullRequests: {
    opened: number;
    merged: number;
    medianHoursToMerge: number | null;
    reviews: number;
    monthly: MonthValues[];
  };
  cicd: {
    runs: number;
    succeeded: number;
    failed: number;
    deploys: number;
    reposWithRuns: number;
    weekly: { week: string; values: Record<string, number> }[];
  };
  career: { joinedYear: number | null; years: CareerYear[] };
}

import { Type } from '@sinclair/typebox';

const Int = Type.Integer({ minimum: 0 });

export const LineCountSchema = Type.Object({ add: Int, del: Int, files: Int });

/** One classified commit. Never holds a message, file name or private repository name. */
export const LedgerCommitSchema = Type.Object({
  sha: Type.String(),
  /** Public: owner/name. Private: "private:<repo id>". */
  repo: Type.String(),
  isPrivate: Type.Boolean(),
  date: Type.String(),
  type: Type.String(),
  isMerge: Type.Boolean(),
  /** Keyed by FileClass (terraform, cdk, ..., test, source, docs, ci). Excluded files are dropped. */
  lines: Type.Record(Type.String(), LineCountSchema),
});

/** Cached scan of one repository's default branch, recomputed when pushedAt changes. */
export const RepoScanSchema = Type.Object({
  repo: Type.String(),
  isPrivate: Type.Boolean(),
  pushedAt: Type.String(),
  scannedAt: Type.String(),
  roots: Type.Object({
    cdk: Type.Array(Type.String()),
    pulumi: Type.Array(Type.String()),
    cloudformation: Type.Array(Type.String()),
    serverless: Type.Array(Type.String()),
  }),
  /** IaC tools present in the tree. */
  tools: Type.Array(Type.String()),
  frameworks: Type.Array(Type.Object({ name: Type.String(), category: Type.String() })),
  providers: Type.Array(Type.String()),
  clouds: Type.Array(Type.String()),
  testBytes: Int,
  codeBytes: Int,
  /** ISO time of the newest commit already listed for this repo. */
  commitsListedUntil: Type.Union([Type.String(), Type.Null()]),
});

export const PendingCommitSchema = Type.Object({
  sha: Type.String(),
  repo: Type.String(),
  isPrivate: Type.Boolean(),
  /** Real repository name, needed to fetch details. Deleted once the commit is classified. */
  fullName: Type.String(),
  queuedAt: Type.String(),
});

export const IacToolStatSchema = Type.Object({
  tool: Type.String(),
  commits: Int,
  linesAdded: Int,
  linesDeleted: Int,
  /** Repositories where I committed to this tool's files. */
  reposTouched: Int,
  /** Repositories whose default branch contains this tool. */
  reposPresent: Int,
});

export const MonthValuesSchema = Type.Object({
  month: Type.String(),
  values: Type.Record(Type.String(), Int),
});

export const InsightsSchema = Type.Object({
  generatedAt: Type.String(),
  coverage: Type.Object({
    commitsAnalyzed: Int,
    commitsPending: Int,
    reposScanned: Int,
    pullRequestsIncludePrivate: Type.Boolean(),
    actionsIncludePrivate: Type.Boolean(),
  }),
  iac: Type.Object({
    tools: Type.Array(IacToolStatSchema),
    monthly: Type.Array(MonthValuesSchema),
    clouds: Type.Array(Type.Object({ cloud: Type.String(), repos: Int })),
    providers: Type.Array(Type.Object({ name: Type.String(), repos: Int })),
  }),
  stack: Type.Array(Type.Object({ name: Type.String(), category: Type.String(), repos: Int })),
  commitTypes: Type.Array(Type.Object({ type: Type.String(), count: Int })),
  testing: Type.Object({
    commitsTotal: Int,
    commitsTouchingTests: Int,
    testLinesAdded: Int,
    codeLinesAdded: Int,
    reposWithTests: Int,
    reposScanned: Int,
    testBytes: Int,
    codeBytes: Int,
  }),
  pullRequests: Type.Object({
    opened: Int,
    merged: Int,
    medianHoursToMerge: Type.Union([Type.Number(), Type.Null()]),
    reviews: Int,
    monthly: Type.Array(MonthValuesSchema),
  }),
  cicd: Type.Object({
    runs: Int,
    succeeded: Int,
    failed: Int,
    deploys: Int,
    reposWithRuns: Int,
    weekly: Type.Array(Type.Object({ week: Type.String(), values: Type.Record(Type.String(), Int) })),
  }),
  career: Type.Object({
    joinedYear: Type.Union([Type.Integer(), Type.Null()]),
    years: Type.Array(
      Type.Object({
        year: Type.Integer(),
        contributions: Int,
        privateContributions: Int,
        commits: Int,
        pullRequests: Int,
      }),
    ),
  }),
});

/** Per-repo workflow-run summary, cached daily. */
export const RepoRunsSchema = Type.Object({
  repo: Type.String(),
  isPrivate: Type.Boolean(),
  fetchedAt: Type.String(),
  /** week (Monday) -> counts */
  weekly: Type.Record(Type.String(), Type.Object({ succeeded: Int, failed: Int, other: Int, deploys: Int })),
  denied: Type.Boolean(),
});

export const PullRequestSummarySchema = Type.Object({
  createdAt: Type.String(),
  mergedAt: Type.Union([Type.String(), Type.Null()]),
  isPrivate: Type.Boolean(),
});

export const PullRequestCountsSchema = Type.Object({
  opened: Int,
  merged: Int,
  /** yyyy-mm -> counts */
  monthly: Type.Record(Type.String(), Type.Object({ opened: Int, merged: Int })),
});

export const CareerYearSchema = Type.Object({
  year: Type.Integer(),
  contributions: Int,
  privateContributions: Int,
  commits: Int,
  pullRequests: Int,
});

/** Slow-changing inputs refreshed on their own cadence (PRs hourly, career and CI daily). */
export const InsightsMetaSchema = Type.Object({
  pullRequests: Type.Array(PullRequestSummarySchema),
  pullRequestsFetchedAt: Type.Union([Type.String(), Type.Null()]),
  pullRequestsIncludePrivate: Type.Boolean(),
  /** Exact totals from search issueCount; `pullRequests` is a sample (max 1,000) used for the median. */
  pullRequestCounts: Type.Optional(PullRequestCountsSchema),
  career: Type.Object({ joinedYear: Type.Union([Type.Integer(), Type.Null()]), years: Type.Array(CareerYearSchema) }),
  careerFetchedAt: Type.Union([Type.String(), Type.Null()]),
  runsFetchedAt: Type.Union([Type.String(), Type.Null()]),
  actionsIncludePrivate: Type.Boolean(),
});

import type { CareerYear, PullRequestCounts, PullRequestSummary, RepoRuns, RepoScan, Result } from '../types/index.mjs';
import type { CommitDetail } from './i-commit-detail.mjs';
import type { CommitRef } from './i-commit-ref.mjs';
import type { RepoTarget } from './i-repo-target.mjs';

/** GitHub data access for insights. Budget-aware: callers check `rateRemaining()` between calls. */
export interface InsightsSource {
  repoTargets(fromIso: string, toIso: string): Promise<Result<RepoTarget[]>>;
  scanRepo(target: RepoTarget, nowIso: string): Promise<Result<RepoScan>>;
  listMyCommits(fullName: string, sinceIso: string): Promise<Result<CommitRef[]>>;
  commitDetail(fullName: string, sha: string): Promise<Result<CommitDetail | null>>;
  pullRequests(
    fromIso: string,
    nowIso: string,
    probeRepo: string | null,
  ): Promise<Result<{ items: PullRequestSummary[]; counts: PullRequestCounts; includePrivate: boolean }>>;
  workflowRuns(target: RepoTarget, fromIso: string, nowIso: string): Promise<Result<RepoRuns>>;
  career(nowIso: string): Promise<Result<{ joinedYear: number | null; years: CareerYear[] }>>;
  rateRemaining(): number | null;
}

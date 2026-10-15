/** GraphQL response for the contributions query in clients/contributions-query.mts. */
export interface ContributionsResponse {
  user: {
    contributionsCollection: {
      startedAt: string;
      endedAt: string;
      restrictedContributionsCount: number;
      totalCommitContributions: number;
      totalPullRequestContributions: number;
      totalPullRequestReviewContributions: number;
      totalIssueContributions: number;
      totalRepositoriesWithContributedCommits: number;
      contributionCalendar: {
        totalContributions: number;
        weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
      };
      commitContributionsByRepository: {
        repository: {
          nameWithOwner: string;
          url: string;
          isPrivate: boolean;
          primaryLanguage: { name: string; color: string | null } | null;
          languages: { edges: { size: number; node: { name: string; color: string | null } }[] };
        };
        contributions: {
          totalCount: number;
          nodes: { occurredAt: string; commitCount: number }[];
        };
      }[];
    };
  } | null;
}

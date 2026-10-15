/** One query returns the calendar, totals and per-repo commit days for the requested window. */
export const CONTRIBUTIONS_QUERY: string = `
query Contributions($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      startedAt
      endedAt
      restrictedContributionsCount
      totalCommitContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      totalIssueContributions
      totalRepositoriesWithContributedCommits
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
      commitContributionsByRepository(maxRepositories: 100) {
        repository {
          nameWithOwner
          url
          isPrivate
          primaryLanguage { name color }
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges { size node { name color } }
          }
        }
        contributions(first: 100) {
          totalCount
          nodes { occurredAt commitCount }
        }
      }
    }
  }
}`;

/** A repository I committed to in the window, as reported by the contributions graph. */
export interface RepoTarget {
  fullName: string;
  databaseId: number;
  isPrivate: boolean;
  pushedAt: string;
  defaultBranch: string | null;
}

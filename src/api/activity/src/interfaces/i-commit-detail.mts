export interface CommitDetail {
  sha: string;
  date: string;
  message: string;
  isMerge: boolean;
  files: { filename: string; additions: number; deletions: number }[];
}

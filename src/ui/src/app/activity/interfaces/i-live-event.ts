/** One push received by the GitHub App webhook. Private pushes arrive redacted. */
export interface LiveEvent {
  id: string;
  receivedAt: string;
  repo: string;
  url: string | null;
  isPrivate: boolean;
  language: string | null;
  branch: string;
  commitCount: number;
  messages: string[];
}

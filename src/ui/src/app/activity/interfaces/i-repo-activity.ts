import type { WeekCount } from './i-week-count';

export interface RepoActivity {
  name: string;
  url: string;
  language: string | null;
  languageColor: string | null;
  commits: number;
  weekly: WeekCount[];
}

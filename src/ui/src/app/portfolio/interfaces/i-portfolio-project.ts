import type { ProjectHighlight } from './i-project-highlight';

/** A public project shown in the portfolio list and on its own summary page. */
export interface PortfolioProject {
  /** URL segment for the summary page: /portfolio/<slug>. */
  slug: string;
  name: string;
  /** One line shown under the name in the list. */
  tagline: string;
  /** Path under public/ to a square app icon. */
  icon: string;
  /** Short status label, such as "Live on iOS and Android". */
  status: string;
  /** Paragraphs for the summary page. */
  summary: string[];
  highlights: ProjectHighlight[];
  /** How the product is built: one line per layer. */
  architecture: ProjectHighlight[];
  stack: string[];
  appStoreUrl?: string;
  playStoreUrl?: string;
  websiteUrl?: string;
}

/**
 * Collects a real snapshot with a local token and writes it to the UI's public folder,
 * so the /activity page can be developed before the GitHub App is deployed.
 *
 *   GITHUB_TOKEN=$(gh auth token) bun scripts/collect-local.mts [deep]
 */
import { TokenGitHubClient } from '../src/clients/token-github-client.mjs';
import { createLogger } from '../src/config/create-logger.mjs';
import { GitHubContributionCollector } from '../src/repositories/github-contribution-collector.mjs';
import { InMemoryInsightsRepository } from '../src/repositories/in-memory-insights-repository.mjs';
import { GitHubInsightsSource } from '../src/repositories/github-insights-source.mjs';
import { DefaultInsightsService } from '../src/services/insights/insights-service.mjs';
import { RefreshDepth } from '../src/types/index.mjs';
import type { Insights } from '../src/types/index.mjs';
import type { AppConfig } from '../src/interfaces/index.mjs';
import type { ActivitySnapshot, Result } from '../src/types/index.mjs';

const token: string | undefined = process.env['GITHUB_TOKEN'];
if (!token) {
  console.error('GITHUB_TOKEN is required, e.g. GITHUB_TOKEN=$(gh auth token)');
  process.exit(1);
}

const config: AppConfig = {
  login: process.env['GITHUB_LOGIN'] ?? 'DavisSylvester',
  tableName: 'unused',
  allowedOrigins: [],
  timezone: process.env['ACTIVITY_TIMEZONE'] ?? 'America/Chicago',
  liveEventTtlDays: 30,
  refreshDebounceSeconds: 0,
  logLevel: 'info',
  secretArn: null,
  functionName: null,
};

const depth: RefreshDepth = process.argv[2] === 'shallow' ? RefreshDepth.Shallow : RefreshDepth.Deep;
const collector: GitHubContributionCollector = new GitHubContributionCollector(
  new TokenGitHubClient(token),
  config,
  createLogger('info'),
  (): Date => new Date(),
);
const res: Result<ActivitySnapshot> = await collector.collect(depth, null);
if (!res.ok) {
  console.error(res.error.message);
  process.exit(1);
}

// Insights: one scheduled pass with a local budget (INSIGHTS_BUDGET, default 600 commit details).
const budget: number = Number(process.env['INSIGHTS_BUDGET'] ?? 600);
if (budget > 0) {
  const client: TokenGitHubClient = new TokenGitHubClient(token);
  const insightsService: DefaultInsightsService = new DefaultInsightsService(
    new InMemoryInsightsRepository(),
    new GitHubInsightsSource(client, config.login, createLogger('info')),
    createLogger('info'),
    (): Date => new Date(),
    { scheduled: budget, push: 0, concurrency: 8, minRate: 300 },
  );
  const started: number = Date.now();
  const insights: Result<Insights> = await insightsService.refreshScheduled(res.value.totals.reviews);
  if (insights.ok) {
    res.value.insights = insights.value;
    console.log(`insights in ${Math.round((Date.now() - started) / 1000)} s`, insights.value.coverage);
  } else {
    console.error('insights failed:', insights.error.message);
  }
}
const out: string = new URL('../../../ui/public/data/activity-sample.json', import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
);
await Bun.write(out, JSON.stringify(res.value, null, 2));
console.log(`wrote ${out}`);
console.log(res.value.totals);

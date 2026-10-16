import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Logger } from 'winston';
import {
  EnvCredentialsProvider,
  GitHubAppClient,
  InlineTrigger,
  LambdaSelfTrigger,
  SecretsManagerCredentialsProvider,
} from './clients/index.mjs';
import type { FetchFn } from './clients/index.mjs';
import { createLogger } from './config/create-logger.mjs';
import { toAppConfig } from './config/load-config.mjs';
import { DynamoActivityRepository } from './repositories/dynamo-activity-repository.mjs';
import { DynamoInsightsRepository } from './repositories/dynamo-insights-repository.mjs';
import { GitHubInsightsSource } from './repositories/github-insights-source.mjs';
import { DefaultInsightsService } from './services/insights/insights-service.mjs';
import type { InsightsBudgets } from './services/insights/insights-service.mjs';
import { GitHubContributionCollector } from './repositories/github-contribution-collector.mjs';
import { DefaultActivityService } from './services/activity-service.mjs';
import { DefaultWebhookService } from './services/webhook-service.mjs';
import type {
  ActivityRepository,
  ActivityService,
  AppConfig,
  AsyncTrigger,
  Container,
  ContributionCollector,
  CredentialsProvider,
  GitHubClient,
  InsightsRepository,
  InsightsService,
  InsightsSource,
  WebhookService,
} from './interfaces/index.mjs';
import type { Env } from './types/index.mjs';

/** Optional replacements, used by tests and the local dev server. */
export interface ContainerOverrides {
  logger?: Logger;
  clock?: () => Date;
  fetchFn?: FetchFn;
  credentials?: CredentialsProvider;
  repository?: ActivityRepository;
  collector?: ContributionCollector;
  insightsRepository?: InsightsRepository;
  insightsSource?: InsightsSource;
  insightsBudgets?: InsightsBudgets;
  trigger?: AsyncTrigger;
}

/** The composition root. The only place in the API that calls `new` on a service. */
export const createContainer = (env: Env, overrides: ContainerOverrides = {}): Container => {
  const config: AppConfig = toAppConfig(env);
  const logger: Logger = overrides.logger ?? createLogger(config.logLevel);
  const clock: () => Date = overrides.clock ?? ((): Date => new Date());
  const fetchFn: FetchFn = overrides.fetchFn ?? ((input: string, init?: RequestInit): Promise<Response> => fetch(input, init));

  const credentials: CredentialsProvider =
    overrides.credentials ??
    (config.secretArn
      ? new SecretsManagerCredentialsProvider(new SecretsManagerClient({}), config.secretArn)
      : new EnvCredentialsProvider(env));

  // Created lazily so tests and local dev that override both repositories never build an AWS client.
  let doc: DynamoDBDocumentClient | null = null;
  const dynamo = (): DynamoDBDocumentClient => (doc ??= DynamoDBDocumentClient.from(new DynamoDBClient({})));
  const repository: ActivityRepository = overrides.repository ?? new DynamoActivityRepository(dynamo(), config.tableName, logger);
  const insightsRepository: InsightsRepository = overrides.insightsRepository ?? new DynamoInsightsRepository(dynamo(), config.tableName);

  const github: GitHubClient = new GitHubAppClient(credentials, logger, fetchFn);
  const collector: ContributionCollector =
    overrides.collector ?? new GitHubContributionCollector(github, config, logger, clock);

  const insightsSource: InsightsSource = overrides.insightsSource ?? new GitHubInsightsSource(github, config.login, logger);
  const insightsService: InsightsService = new DefaultInsightsService(insightsRepository, insightsSource, logger, clock, overrides.insightsBudgets);

  const activityService: ActivityService = new DefaultActivityService(repository, collector, config, logger, clock, insightsService);
  const trigger: AsyncTrigger =
    overrides.trigger ??
    (config.functionName
      ? new LambdaSelfTrigger(new LambdaClient({}), config.functionName, logger)
      : new InlineTrigger((): ActivityService => activityService, logger));
  const webhookService: WebhookService = new DefaultWebhookService(
    credentials,
    repository,
    insightsService,
    trigger,
    config,
    logger,
    clock,
  );

  return { config, logger, repository, activityService, insightsService, webhookService };
};

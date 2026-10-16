import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Logger } from 'winston';
import {
  EnvCredentialsProvider,
  GitHubAppClient,
  SecretsManagerCredentialsProvider,
} from './clients/index.mjs';
import type { FetchFn } from './clients/index.mjs';
import { createLogger } from './config/create-logger.mjs';
import { toAppConfig } from './config/load-config.mjs';
import { DynamoActivityRepository } from './repositories/dynamo-activity-repository.mjs';
import { GitHubContributionCollector } from './repositories/github-contribution-collector.mjs';
import { DefaultActivityService } from './services/activity-service.mjs';
import { DefaultWebhookService } from './services/webhook-service.mjs';
import type {
  ActivityRepository,
  ActivityService,
  AppConfig,
  Container,
  ContributionCollector,
  CredentialsProvider,
  GitHubClient,
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

  const repository: ActivityRepository =
    overrides.repository ??
    new DynamoActivityRepository(
      DynamoDBDocumentClient.from(new DynamoDBClient({})),
      config.tableName,
      logger,
    );

  const github: GitHubClient = new GitHubAppClient(credentials, logger, fetchFn);
  const collector: ContributionCollector =
    overrides.collector ?? new GitHubContributionCollector(github, config, logger, clock);

  const activityService: ActivityService = new DefaultActivityService(repository, collector, config, logger, clock);
  const webhookService: WebhookService = new DefaultWebhookService(
    credentials,
    repository,
    activityService,
    config,
    logger,
    clock,
  );

  return { config, logger, repository, activityService, webhookService };
};

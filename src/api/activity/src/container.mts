import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { PinpointSMSVoiceV2Client } from '@aws-sdk/client-pinpoint-sms-voice-v2';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { SESv2Client } from '@aws-sdk/client-sesv2';
import { SocialMessagingClient } from '@aws-sdk/client-socialmessaging';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Logger } from 'winston';
import {
  AwsSmsNotifier,
  AwsWhatsAppNotifier,
  EnvContactSecretsProvider,
  EnvCredentialsProvider,
  GitHubAppClient,
  InlineTrigger,
  LambdaSelfTrigger,
  SecretsManagerContactSecretsProvider,
  SesEmailNotifier,
  SecretsManagerCredentialsProvider,
  SlackNotifier,
  TeamsNotifier,
  TelegramNotifier,
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
import { DefaultContactService } from './services/contact/contact-service.mjs';
import { DynamoContactRepository } from './repositories/dynamo-contact-repository.mjs';
import type {
  ActivityRepository,
  ActivityService,
  AppConfig,
  AsyncTrigger,
  ContactRepository,
  ContactSecretsProvider,
  ContactService,
  Container,
  ContributionCollector,
  CredentialsProvider,
  GitHubClient,
  InsightsRepository,
  InsightsService,
  InsightsSource,
  Notifier,
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
  contactRepository?: ContactRepository;
  contactSecrets?: ContactSecretsProvider;
  notifiers?: Notifier[];
  newId?: () => string;
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

  const contactSecrets: ContactSecretsProvider =
    overrides.contactSecrets ??
    (config.contact.secretArn
      ? new SecretsManagerContactSecretsProvider(new SecretsManagerClient({}), config.contact.secretArn)
      : new EnvContactSecretsProvider(env));
  const notifiers: Notifier[] = overrides.notifiers ?? [
    new SesEmailNotifier(config.contact, new SESv2Client({})),
    new AwsSmsNotifier(contactSecrets, config.contact, new PinpointSMSVoiceV2Client({})),
    new AwsWhatsAppNotifier(contactSecrets, config.contact, new SocialMessagingClient({})),
    new TelegramNotifier(contactSecrets, fetchFn),
    new SlackNotifier(contactSecrets, fetchFn),
    new TeamsNotifier(contactSecrets, fetchFn),
  ];
  const contactRepository: ContactRepository = overrides.contactRepository ?? new DynamoContactRepository(dynamo(), config.tableName);
  const contactService: ContactService = new DefaultContactService(
    contactRepository,
    notifiers,
    config.contact,
    logger,
    clock,
    overrides.newId,
  );

  return { config, logger, repository, activityService, insightsService, webhookService, contactService };
};

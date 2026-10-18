import type { Logger } from 'winston';
import type { ActivityRepository } from './i-activity-repository.mjs';
import type { ActivityService } from './i-activity-service.mjs';
import type { AppConfig } from './i-app-config.mjs';
import type { InsightsService } from './i-insights-service.mjs';
import type { WebhookService } from './i-webhook-service.mjs';
import type { ContactService } from './i-contact-service.mjs';

/** Composition root output. Routers receive services only, never repositories. */
export interface Container {
  config: AppConfig;
  logger: Logger;
  repository: ActivityRepository;
  activityService: ActivityService;
  insightsService: InsightsService;
  webhookService: WebhookService;
  contactService: ContactService;
}

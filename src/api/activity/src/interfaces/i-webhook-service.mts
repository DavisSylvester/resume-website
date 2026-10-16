import type { Result, WebhookOutcome } from '../types/index.mjs';
import type { WebhookRequest } from './i-webhook-request.mjs';
import type { WebhookError } from '../errors/webhook-error.mjs';

export interface WebhookService {
  handle(request: WebhookRequest): Promise<Result<WebhookOutcome, WebhookError>>;
}

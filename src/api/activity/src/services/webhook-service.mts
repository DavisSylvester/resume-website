import { createHmac, timingSafeEqual } from 'node:crypto';
import { Value } from '@sinclair/typebox/value';
import type { Logger } from 'winston';
import { WebhookError, WebhookErrorCode } from '../errors/index.mjs';
import { PushPayloadSchema } from '../schemas/index.mjs';
import { fail, ok, RefreshDepth, WebhookOutcome } from '../types/index.mjs';
import type {
  ActivityRepository,
  ActivityService,
  AppConfig,
  CredentialsProvider,
  WebhookRequest,
  WebhookService,
} from '../interfaces/index.mjs';
import type { AppCredentials, LiveEvent, PushPayload, Result } from '../types/index.mjs';

const MAX_MESSAGES: number = 5;
const MAX_MESSAGE_LENGTH: number = 120;

/** Constant-time check of GitHub's X-Hub-Signature-256 header. */
export const verifySignature = (secret: string, rawBody: string, header: string): boolean => {
  if (!header.startsWith('sha256=')) return false;
  const expected: Buffer = Buffer.from(`sha256=${createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`);
  const actual: Buffer = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

/**
 * Turns a push payload into a LiveEvent. Private pushes keep only the commit count and
 * language: the repo name, branch, url and commit messages never leave this function.
 */
export const toLiveEvent = (payload: PushPayload, deliveryId: string, receivedAt: Date): LiveEvent => {
  const isPrivate: boolean = payload.repository.private;
  const commits: PushPayload['commits'] = payload.commits.filter(
    (c: PushPayload['commits'][number]): boolean => c.distinct !== false,
  );
  return {
    id: deliveryId,
    receivedAt: receivedAt.toISOString(),
    repo: isPrivate ? 'Private repository' : payload.repository.full_name,
    url: isPrivate ? null : payload.repository.html_url,
    isPrivate,
    language: payload.repository.language ?? null,
    branch: isPrivate ? '' : payload.ref.replace(/^refs\/heads\//, ''),
    commitCount: commits.length,
    messages: isPrivate
      ? []
      : commits
          .slice(-MAX_MESSAGES)
          .reverse()
          .map((c: PushPayload['commits'][number]): string => {
            const firstLine: string = c.message.split('\n')[0] ?? '';
            return firstLine.length > MAX_MESSAGE_LENGTH ? `${firstLine.slice(0, MAX_MESSAGE_LENGTH - 1)}…` : firstLine;
          }),
  };
};

export class DefaultWebhookService implements WebhookService {

  private readonly credentials: CredentialsProvider;
  private readonly repository: ActivityRepository;
  private readonly activityService: ActivityService;
  private readonly config: AppConfig;
  private readonly logger: Logger;
  private readonly clock: () => Date;

  public constructor(
    credentials: CredentialsProvider,
    repository: ActivityRepository,
    activityService: ActivityService,
    config: AppConfig,
    logger: Logger,
    clock: () => Date,
  ) {
    this.credentials = credentials;
    this.repository = repository;
    this.activityService = activityService;
    this.config = config;
    this.logger = logger;
    this.clock = clock;
  }

  public async handle(request: WebhookRequest): Promise<Result<WebhookOutcome, WebhookError>> {
    const creds: Result<AppCredentials> = await this.credentials.get();
    if (!creds.ok) {
      this.logger.error('webhook received but App credentials are unavailable', { error: creds.error.message });
      return fail(new WebhookError(WebhookErrorCode.NotConfigured, 'App credentials unavailable'));
    }
    if (!verifySignature(creds.value.webhookSecret, request.rawBody, request.signature)) {
      this.logger.warn('webhook signature mismatch', { deliveryId: request.deliveryId });
      return fail(new WebhookError(WebhookErrorCode.BadSignature, 'Invalid signature'));
    }

    if (request.event === 'ping') return ok(WebhookOutcome.Pong);
    if (request.event !== 'push') return ok(WebhookOutcome.Ignored);

    let body: unknown;
    try {
      body = JSON.parse(request.rawBody);
    } catch {
      return fail(new WebhookError(WebhookErrorCode.BadPayload, 'Body is not JSON'));
    }
    if (!Value.Check(PushPayloadSchema, body)) {
      return fail(new WebhookError(WebhookErrorCode.BadPayload, 'Unexpected push payload shape'));
    }
    // Only the site owner's own pushes count; ignore branch deletions and empty pushes.
    if (body.sender.login.toLowerCase() !== this.config.login.toLowerCase()) return ok(WebhookOutcome.Ignored);
    if (body.deleted === true) return ok(WebhookOutcome.Ignored);

    const event: LiveEvent = toLiveEvent(body, request.deliveryId, this.clock());
    if (event.commitCount === 0) return ok(WebhookOutcome.Ignored);

    const stored: Result<void> = await this.repository.putLiveEvent(event, this.config.liveEventTtlDays);
    if (!stored.ok) {
      this.logger.error('failed to store live event', { error: stored.error.message });
      return fail(new WebhookError(WebhookErrorCode.StorageFailed, 'Could not store event'));
    }

    // Shallow refresh: one GraphQL call, debounced so a burst of pushes costs one call.
    const refreshed: Result<unknown> = await this.activityService.refresh(RefreshDepth.Shallow, true);
    if (!refreshed.ok) this.logger.warn('post-push refresh failed', { error: refreshed.error.message });
    return ok(WebhookOutcome.Stored);
  }
}

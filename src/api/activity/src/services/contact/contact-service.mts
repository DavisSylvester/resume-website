import type { Logger } from 'winston';
import { validateReplyTo } from './validate-reply-to.mjs';
import { ContactError, ContactErrorCode } from '../../errors/index.mjs';
import { fail, ok, NotifyOutcome } from '../../types/index.mjs';
import type { ContactConfig, ContactMessage, ContactReceipt, ContactRepository, ContactService, Notifier } from '../../interfaces/index.mjs';
import type { ContactRequest, NotifyChannel, Result } from '../../types/index.mjs';

const WINDOW_SECONDS: number = 60 * 60;

/**
 * Validates a contact request, throttles it per source IP, keeps an audit copy, then fans it
 * out to every notifier in parallel. Succeeds when at least one channel delivered it.
 */
export class DefaultContactService implements ContactService {

  private readonly repository: ContactRepository;
  private readonly notifiers: Notifier[];
  private readonly config: ContactConfig;
  private readonly logger: Logger;
  private readonly clock: () => Date;
  private readonly newId: () => string;

  public constructor(
    repository: ContactRepository,
    notifiers: Notifier[],
    config: ContactConfig,
    logger: Logger,
    clock: () => Date,
    newId: () => string = (): string => crypto.randomUUID(),
  ) {
    this.repository = repository;
    this.notifiers = notifiers;
    this.config = config;
    this.logger = logger;
    this.clock = clock;
    this.newId = newId;
  }

  public async submit(request: ContactRequest, sourceIp: string): Promise<Result<ContactReceipt, ContactError>> {
    const id: string = this.newId();

    // Bots that fill the hidden field get a normal-looking success and nothing is sent.
    if (request.website && request.website.trim().length > 0) {
      this.logger.warn('contact honeypot triggered', { sourceIp });
      return ok({ id, delivered: [] });
    }

    const invalid: string | null = validateReplyTo(request.replyVia, request.replyTo);
    if (invalid) return fail(new ContactError(ContactErrorCode.Invalid, invalid));

    const now: Date = this.clock();
    const hits: Result<number> = await this.repository.recordHit(`ip#${sourceIp}`, WINDOW_SECONDS, now);
    if (!hits.ok) {
      // Fail open: a storage hiccup should not stop a real person reaching Davis.
      this.logger.error('contact rate-limit check failed', { error: hits.error.message });
    } else if (hits.value > this.config.rateLimitPerHour) {
      return fail(new ContactError(ContactErrorCode.RateLimited, 'Too many messages. Please try again later.'));
    }

    const message: ContactMessage = {
      id,
      receivedAt: now.toISOString(),
      name: request.name.trim(),
      reason: request.reason,
      replyVia: request.replyVia,
      replyTo: request.replyTo.trim(),
      company: request.company?.trim() || null,
      message: request.message.trim(),
      sourceIp,
    };

    const saved: Result<void> = await this.repository.save(message);
    if (!saved.ok) this.logger.error('contact audit save failed', { id, error: saved.error.message });

    const outcomes: { channel: NotifyChannel; result: Result<NotifyOutcome> }[] = await Promise.all(
      this.notifiers.map(async (n: Notifier): Promise<{ channel: NotifyChannel; result: Result<NotifyOutcome> }> => ({
        channel: n.channel,
        result: await n.send(message).catch((error: unknown): Result<NotifyOutcome> =>
          fail(error instanceof Error ? error : new Error(String(error))),
        ),
      })),
    );

    const delivered: NotifyChannel[] = [];
    let failures: number = 0;
    for (const { channel, result } of outcomes) {
      if (!result.ok) {
        failures += 1;
        this.logger.error('contact delivery failed', { id, channel, error: result.error.message });
      } else if (result.value === NotifyOutcome.Sent) {
        delivered.push(channel);
      }
    }
    this.logger.info('contact request processed', { id, reason: message.reason, delivered, failures });

    if (delivered.length > 0) return ok({ id, delivered });
    return failures > 0
      ? fail(new ContactError(ContactErrorCode.DeliveryFailed, 'Your message could not be delivered. Please email instead.'))
      : fail(new ContactError(ContactErrorCode.NotConfigured, 'Messaging is not set up yet. Please email instead.'));
  }
}

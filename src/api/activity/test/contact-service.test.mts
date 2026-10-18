/**
 * DefaultContactService: honeypot, reply-to validation, per-IP throttling, the audit copy,
 * and how per-channel outcomes roll up into success, 502 or 503.
 */
import { describe, expect, test } from 'bun:test';
import { ContactErrorCode } from '../src/errors/index.mjs';
import { InMemoryContactRepository } from '../src/repositories/in-memory-contact-repository.mjs';
import { DefaultContactService } from '../src/services/contact/contact-service.mjs';
import { fail, ok, NotifyChannel, NotifyOutcome } from '../src/types/index.mjs';
import type { ContactConfig, ContactMessage, ContactRepository, Notifier } from '../src/interfaces/index.mjs';
import type { ContactRequest, NotifyChannel as Channel, NotifyOutcome as Outcome, Result } from '../src/types/index.mjs';
import { fixedClock, silentLogger } from './helpers.mjs';

const config: ContactConfig = { secretArn: null, emailTo: 'davis@example.com', emailFrom: null, phoneTo: '+12145550100', rateLimitPerHour: 2 };

const request = (overrides: Partial<ContactRequest> = {}): ContactRequest => ({
  name: ' Ada Lovelace ',
  reason: 'consulting',
  replyVia: 'email',
  replyTo: 'ada@example.com',
  message: ' Can we talk about a platform build? ',
  ...overrides,
});

/** A notifier that records what it received and returns a fixed result. */
const notifier = (channel: Channel, result: Result<Outcome>): Notifier & { received: ContactMessage[] } => {
  const received: ContactMessage[] = [];
  return {
    channel,
    received,
    send: async (m: ContactMessage): Promise<Result<Outcome>> => {
      received.push(m);
      return result;
    },
  };
};

const service = (notifiers: Notifier[], repo: ContactRepository = new InMemoryContactRepository()): DefaultContactService =>
  new DefaultContactService(repo, notifiers, config, silentLogger(), fixedClock('2026-10-18T15:00:00Z'), (): string => 'id-1');

describe('DefaultContactService', () => {
  test('delivers to every configured channel and reports which ones sent', async () => {
    const email = notifier(NotifyChannel.Email, ok(NotifyOutcome.Sent));
    const slack = notifier(NotifyChannel.Slack, ok(NotifyOutcome.Sent));
    const teams = notifier(NotifyChannel.Teams, ok(NotifyOutcome.Skipped));
    const repo: InMemoryContactRepository = new InMemoryContactRepository();

    const res = await service([email, slack, teams], repo).submit(request({ company: ' ' }), '1.2.3.4');

    expect(res).toEqual({ ok: true, value: { id: 'id-1', delivered: ['email', 'slack'] } });
    expect(email.received[0]).toMatchObject({
      name: 'Ada Lovelace',
      message: 'Can we talk about a platform build?',
      company: null,
      sourceIp: '1.2.3.4',
      receivedAt: '2026-10-18T15:00:00.000Z',
    });
    expect(repo.saved).toHaveLength(1);
  });

  test('one failing channel does not fail the request', async () => {
    const res = await service([
      notifier(NotifyChannel.Sms, fail(new Error('twilio down'))),
      notifier(NotifyChannel.Telegram, ok(NotifyOutcome.Sent)),
    ]).submit(request(), '1.2.3.4');
    expect(res.ok && res.value.delivered).toEqual(['telegram']);
  });

  test('a notifier that throws is treated as a failure, not a crash', async () => {
    const throwing: Notifier = {
      channel: NotifyChannel.Slack,
      send: async (): Promise<Result<Outcome>> => {
        throw new Error('boom');
      },
    };
    const res = await service([throwing]).submit(request(), '1.2.3.4');
    expect(!res.ok && res.error.code).toBe(ContactErrorCode.DeliveryFailed);
  });

  test('every channel failing is a 502', async () => {
    const res = await service([notifier(NotifyChannel.Email, fail(new Error('x')))]).submit(request(), '1.2.3.4');
    expect(!res.ok && res.error.status).toBe(502);
  });

  test('no channel configured is a 503', async () => {
    const res = await service([notifier(NotifyChannel.Email, ok(NotifyOutcome.Skipped))]).submit(request(), '1.2.3.4');
    expect(!res.ok && res.error.code).toBe(ContactErrorCode.NotConfigured);
    expect(!res.ok && res.error.status).toBe(503);
  });

  test('the honeypot short-circuits: success reply, nothing sent or stored', async () => {
    const email = notifier(NotifyChannel.Email, ok(NotifyOutcome.Sent));
    const repo: InMemoryContactRepository = new InMemoryContactRepository();
    const res = await service([email], repo).submit(request({ website: 'http://spam.example' }), '1.2.3.4');
    expect(res).toEqual({ ok: true, value: { id: 'id-1', delivered: [] } });
    expect(email.received).toHaveLength(0);
    expect(repo.saved).toHaveLength(0);
  });

  test('rejects a reply-to that does not match the channel', async () => {
    const res = await service([notifier(NotifyChannel.Email, ok(NotifyOutcome.Sent))]).submit(
      request({ replyVia: 'sms', replyTo: 'not-a-phone' }),
      '1.2.3.4',
    );
    expect(!res.ok && res.error.status).toBe(400);
  });

  test('throttles per IP after the hourly limit', async () => {
    const svc: DefaultContactService = service([notifier(NotifyChannel.Email, ok(NotifyOutcome.Sent))]);
    expect((await svc.submit(request(), '9.9.9.9')).ok).toBe(true);
    expect((await svc.submit(request(), '9.9.9.9')).ok).toBe(true);
    const third = await svc.submit(request(), '9.9.9.9');
    expect(!third.ok && third.error.status).toBe(429);
    expect((await svc.submit(request(), '8.8.8.8')).ok).toBe(true);
  });

  test('fails open when the rate-limit store is down', async () => {
    const broken: ContactRepository = {
      recordHit: async (): Promise<Result<number>> => fail(new Error('dynamo down')),
      save: async (): Promise<Result<void>> => fail(new Error('dynamo down')),
    };
    const res = await service([notifier(NotifyChannel.Email, ok(NotifyOutcome.Sent))], broken).submit(request(), '1.2.3.4');
    expect(res.ok).toBe(true);
  });
});

import { createHmac } from 'node:crypto';
import { describe, expect, test } from 'bun:test';
import { InMemoryActivityRepository } from '../src/repositories/in-memory-activity-repository.mjs';
import { DefaultActivityService } from '../src/services/activity-service.mjs';
import { DefaultWebhookService, toLiveEvent, verifySignature } from '../src/services/webhook-service.mjs';
import { toAppConfig } from '../src/config/load-config.mjs';
import { ok, WebhookOutcome } from '../src/types/index.mjs';
import type { ContributionCollector, CredentialsProvider, WebhookRequest } from '../src/interfaces/index.mjs';
import type { DefaultWebhookService as WebhookServiceType } from '../src/services/webhook-service.mjs';
import type { ActivitySnapshot, LiveEvent, PushPayload } from '../src/types/index.mjs';
import { fixedClock, sampleSnapshot, silentLogger, testEnv } from './helpers.mjs';

const SECRET: string = 'a-very-secret-webhook-key';
const sign = (body: string, secret: string = SECRET): string =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

const payload = (overrides: Partial<PushPayload> = {}): PushPayload => ({
  ref: 'refs/heads/main',
  repository: {
    full_name: 'DavisSylvester/top-secret',
    private: true,
    html_url: 'https://github.com/DavisSylvester/top-secret',
    language: 'TypeScript',
  },
  commits: [
    { id: '1', message: 'feat: secret thing\n\nmore', distinct: true },
    { id: '2', message: 'dup from merge', distinct: false },
  ],
  sender: { login: 'DavisSylvester' },
  ...overrides,
});

interface Harness {
  repository: InMemoryActivityRepository;
  service: WebhookServiceType;
  collects: () => number;
}

const setup = (): Harness => {
  const repository = new InMemoryActivityRepository();
  let collects: number = 0;
  const collector: ContributionCollector = {
    collect: async (): Promise<ReturnType<typeof ok<ActivitySnapshot>>> => {
      collects += 1;
      return ok(sampleSnapshot());
    },
  };
  const credentials: CredentialsProvider = {
    get: async () => ok({ appId: '1', installationId: '2', privateKey: 'k', webhookSecret: SECRET }),
  };
  const config = toAppConfig(testEnv());
  const clock = fixedClock('2026-10-14T15:00:00Z');
  const activity = new DefaultActivityService(repository, collector, config, silentLogger(), clock);
  const service = new DefaultWebhookService(credentials, repository, activity, config, silentLogger(), clock);
  return { repository, service, collects: (): number => collects };
};

describe('verifySignature', () => {
  test('accepts the exact HMAC and rejects tampering', () => {
    const body: string = '{"a":1}';
    expect(verifySignature(SECRET, body, sign(body))).toBe(true);
    expect(verifySignature(SECRET, '{"a":2}', sign(body))).toBe(false);
    expect(verifySignature(SECRET, body, sign(body, 'other-secret-value'))).toBe(false);
    expect(verifySignature(SECRET, body, 'sha1=abc')).toBe(false);
    expect(verifySignature(SECRET, body, '')).toBe(false);
  });
});

describe('toLiveEvent', () => {
  test('redacts everything identifying about a private push', () => {
    const event: LiveEvent = toLiveEvent(payload(), 'd1', new Date('2026-10-14T15:00:00Z'));
    expect(event).toEqual({
      id: 'd1',
      receivedAt: '2026-10-14T15:00:00.000Z',
      repo: 'Private repository',
      url: null,
      isPrivate: true,
      language: 'TypeScript',
      branch: '',
      commitCount: 1,
      messages: [],
    });
    expect(JSON.stringify(event)).not.toContain('secret');
  });

  test('keeps first-line messages for a public push, newest first', () => {
    const event: LiveEvent = toLiveEvent(
      payload({
        repository: { full_name: 'DavisSylvester/pub', private: false, html_url: 'https://x', language: null },
        commits: [
          { id: '1', message: 'first\nbody' },
          { id: '2', message: 'second' },
        ],
      }),
      'd2',
      new Date('2026-10-14T15:00:00Z'),
    );
    expect(event.repo).toBe('DavisSylvester/pub');
    expect(event.branch).toBe('main');
    expect(event.messages).toEqual(['second', 'first']);
  });
});

describe('DefaultWebhookService', () => {
  const request = (event: string, body: string, signature: string = sign(body)): WebhookRequest => ({
    event,
    deliveryId: 'delivery-1',
    signature,
    rawBody: body,
  });

  test('rejects a bad signature with 401 and stores nothing', async () => {
    const { service, repository } = setup();
    const res = await service.handle(request('push', JSON.stringify(payload()), 'sha256=00'));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.status).toBe(401);
    const events = await repository.listLiveEvents(null, 10);
    expect(events.ok && events.value).toEqual([]);
  });

  test('answers ping', async () => {
    const { service } = setup();
    const res = await service.handle(request('ping', '{}'));
    expect(res).toEqual({ ok: true, value: WebhookOutcome.Pong });
  });

  test('stores a push and triggers one shallow refresh', async () => {
    const { service, repository, collects } = setup();
    const res = await service.handle(request('push', JSON.stringify(payload())));
    expect(res).toEqual({ ok: true, value: WebhookOutcome.Stored });
    const events = await repository.listLiveEvents(null, 10);
    expect(events.ok && events.value.length).toBe(1);
    expect(collects()).toBe(1);
  });

  test('ignores pushes by other people and branch deletions', async () => {
    const { service } = setup();
    const other = await service.handle(request('push', JSON.stringify(payload({ sender: { login: 'someone-else' } }))));
    const deleted = await service.handle(request('push', JSON.stringify(payload({ deleted: true }))));
    expect(other).toEqual({ ok: true, value: WebhookOutcome.Ignored });
    expect(deleted).toEqual({ ok: true, value: WebhookOutcome.Ignored });
  });

  test('a malformed push payload is a 400', async () => {
    const { service } = setup();
    const res = await service.handle(request('push', JSON.stringify({ ref: 1 })));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.status).toBe(400);
  });
});

import { createHmac } from 'node:crypto';
import { describe, expect, test } from 'bun:test';
import { createContainer } from '../src/container.mjs';
import { InMemoryActivityRepository } from '../src/repositories/in-memory-activity-repository.mjs';
import { InMemoryContactRepository } from '../src/repositories/in-memory-contact-repository.mjs';
import { createActivityRouter } from '../src/routes/activity-router.mjs';
import type { AnyElysia } from 'elysia';
import { NotifyChannel, NotifyOutcome, ok } from '../src/types/index.mjs';
import type { ContactMessage } from '../src/interfaces/index.mjs';
import type { ActivitySnapshot, NotifyOutcome as Outcome, Result } from '../src/types/index.mjs';
import { sampleSnapshot, silentLogger, testEnv } from './helpers.mjs';

const SECRET: string = 'router-test-webhook-secret';

const app = (seed: ActivitySnapshot | null): AnyElysia =>
  createActivityRouter(
    createContainer(testEnv(), {
      logger: silentLogger(),
      repository: new InMemoryActivityRepository(seed),
      credentials: { get: async () => ok({ appId: '1', installationId: '2', privateKey: 'k', webhookSecret: SECRET }) },
      collector: { collect: async () => ok(sampleSnapshot()) },
    }),
  );

const call = (a: AnyElysia, path: string, init?: RequestInit): Promise<Response> =>
  a.handle(new Request(`http://local${path}`, init));

describe('activity router', () => {
  test('/activity/health is liveness', async () => {
    const res = await call(app(null), '/activity/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  test('/activity/ready reports readiness', async () => {
    const res = await call(app(null), '/activity/ready');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ready', hasSnapshot: false });
  });

  test('snapshot is 404 before the first collection and 200 after', async () => {
    expect((await call(app(null), '/activity/snapshot')).status).toBe(404);
    const res = await call(app(sampleSnapshot()), '/activity/snapshot');
    expect(res.status).toBe(200);
    expect(((await res.json()) as ActivitySnapshot).totals.privateContributions).toBe(900);
  });

  test('CORS allows configured origins only', async () => {
    const a = app(sampleSnapshot());
    const good = await call(a, '/activity/snapshot', { headers: { origin: 'https://www.dsylvester.io' } });
    const bad = await call(a, '/activity/snapshot', { headers: { origin: 'https://evil.example' } });
    expect(good.headers.get('access-control-allow-origin')).toBe('https://www.dsylvester.io');
    expect(bad.headers.get('access-control-allow-origin')).toBeNull();
  });

  test('webhook verifies the signature over the raw body', async () => {
    const a = app(sampleSnapshot());
    const body: string = JSON.stringify({ zen: 'Keep it logically awesome.', hook_id: 1 });
    const headers = (sig: string): Record<string, string> => ({
      'content-type': 'application/json',
      'x-github-event': 'ping',
      'x-github-delivery': 'abc',
      'x-hub-signature-256': sig,
    });
    const good = await call(a, '/webhooks/github', {
      method: 'POST',
      headers: headers(`sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`),
      body,
    });
    const bad = await call(a, '/webhooks/github', { method: 'POST', headers: headers('sha256=deadbeef'), body });
    expect(good.status).toBe(202);
    expect(await good.json()).toEqual({ outcome: 'pong' });
    expect(bad.status).toBe(401);
  });

  test('live feed returns an empty list and a cursor', async () => {
    const res = await call(app(null), '/activity/live');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ events: [], cursor: '' });
  });
});

describe('contact route', () => {
  const contactApp = (received: ContactMessage[]): AnyElysia =>
    createActivityRouter(
      createContainer(testEnv(), {
        logger: silentLogger(),
        repository: new InMemoryActivityRepository(null),
        contactRepository: new InMemoryContactRepository(),
        newId: (): string => 'id-1',
        notifiers: [
          {
            channel: NotifyChannel.Telegram,
            send: async (m: ContactMessage): Promise<Result<Outcome>> => {
              received.push(m);
              return ok(NotifyOutcome.Sent);
            },
          },
        ],
      }),
    );

  const post = (a: AnyElysia, body: unknown, headers: Record<string, string> = {}): Promise<Response> =>
    call(a, '/contact', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

  const valid = { name: 'Ada', reason: 'resume', replyVia: 'sms', replyTo: '214-555-0100', message: 'Please send your resume.' };

  test('accepts a valid request and passes the source IP through', async () => {
    const received: ContactMessage[] = [];
    const res = await post(contactApp(received), valid, { 'x-source-ip': '5.6.7.8' });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ id: 'id-1', delivered: ['telegram'] });
    expect(received[0]?.sourceIp).toBe('5.6.7.8');
  });

  test('schema rejects an unknown reason', async () => {
    const res = await post(contactApp([]), { ...valid, reason: 'sales' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('channel-specific validation returns 400 with a code', async () => {
    const res = await post(contactApp([]), { ...valid, replyVia: 'email', replyTo: 'nope' });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe('invalid');
  });

  test('preflight allows POST from the site', async () => {
    const res = await call(contactApp([]), '/contact', { method: 'OPTIONS', headers: { origin: 'https://www.dsylvester.io' } });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });
});

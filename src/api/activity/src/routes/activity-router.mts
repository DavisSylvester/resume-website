import { Elysia, t } from 'elysia';
import type { AnyElysia } from 'elysia';
import { ContactRequestSchema } from '../schemas/index.mjs';
import type { ContactError, WebhookError } from '../errors/index.mjs';
import type { ActivityService, AppConfig, ContactReceipt, ContactService, WebhookService } from '../interfaces/index.mjs';
import type { ActivitySnapshot, LiveEventList, Result, WebhookOutcome } from '../types/index.mjs';

export interface RouterDeps {
  config: AppConfig;
  activityService: ActivityService;
  webhookService: WebhookService;
  contactService: ContactService;
}

/** Set by the Lambda handler from the API Gateway request context; absent locally. */
export const SOURCE_IP_HEADER: string = 'x-source-ip';

const json = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

/** HTTP in/out only. All behaviour lives in the services. */
export const createActivityRouter = (deps: RouterDeps): AnyElysia => {
  const allowed: Set<string> = new Set(deps.config.allowedOrigins);

  return new Elysia()
    .onRequest(({ request, set }): void => {
      const origin: string | null = request.headers.get('origin');
      if (origin && allowed.has(origin)) {
        set.headers['access-control-allow-origin'] = origin;
        set.headers['vary'] = 'Origin';
        set.headers['access-control-allow-methods'] = 'GET, POST, OPTIONS';
        set.headers['access-control-allow-headers'] = 'content-type';
        set.headers['access-control-max-age'] = '600';
      }
    })
    .options('/activity/*', (): Response => new Response(null, { status: 204 }))
    .options('/contact', (): Response => new Response(null, { status: 204 }))
    .get('/activity/health', (): { status: string } => ({ status: 'ok' }))
    .get('/activity/ready', async (): Promise<Response> => {
      const res: Result<ActivitySnapshot | null> = await deps.activityService.getSnapshot();
      return res.ok
        ? json(200, { status: 'ready', hasSnapshot: res.value !== null })
        : json(503, { status: 'unavailable' });
    })
    .get('/activity/snapshot', async ({ set }): Promise<ActivitySnapshot | Response> => {
      const res: Result<ActivitySnapshot | null> = await deps.activityService.getSnapshot();
      if (!res.ok) return json(503, { message: 'Activity store unavailable' });
      if (!res.value) return json(404, { message: 'No snapshot collected yet' });
      set.headers['cache-control'] = 'public, max-age=30';
      return res.value;
    })
    .get(
      '/activity/live',
      async ({ query, set }): Promise<LiveEventList | Response> => {
        const res: Result<LiveEventList> = await deps.activityService.getLiveEvents(query.since ?? null);
        if (!res.ok) return json(503, { message: 'Activity store unavailable' });
        set.headers['cache-control'] = 'no-store';
        return res.value;
      },
      { query: t.Object({ since: t.Optional(t.String({ maxLength: 128 })) }) },
    )
    .post(
      '/webhooks/github',
      async ({ request }): Promise<Response> => {
        // The signature covers the exact bytes GitHub sent, so read the raw body.
        const rawBody: string = await request.text();
        const res: Result<WebhookOutcome, WebhookError> = await deps.webhookService.handle({
          event: request.headers.get('x-github-event') ?? '',
          deliveryId: request.headers.get('x-github-delivery') ?? crypto.randomUUID(),
          signature: request.headers.get('x-hub-signature-256') ?? '',
          rawBody,
        });
        return res.ok ? json(202, { outcome: res.value }) : json(res.error.status, { message: res.error.message });
      },
      { parse: 'none' },
    )
    .post(
      '/contact',
      async ({ body, request }): Promise<Response> => {
        const sourceIp: string = request.headers.get(SOURCE_IP_HEADER) ?? 'local';
        const res: Result<ContactReceipt, ContactError> = await deps.contactService.submit(body, sourceIp);
        return res.ok ? json(202, res.value) : json(res.error.status, { code: res.error.code, message: res.error.message });
      },
      { body: ContactRequestSchema },
    );
};

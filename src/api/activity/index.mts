import { createContainer } from './src/container.mjs';
import { loadEnv } from './src/config/load-config.mjs';
import { createActivityRouter } from './src/routes/activity-router.mjs';
import { PUSH_EVENT_SOURCE } from './src/clients/async-triggers.mjs';
import { RefreshDepth } from './src/types/index.mjs';
import type { Container, LambdaEvent, LambdaResult } from './src/interfaces/index.mjs';
import type { ActivitySnapshot, Result } from './src/types/index.mjs';

type App = ReturnType<typeof createActivityRouter>;

let cached: { container: Container; app: App } | null = null;

/** Built once per warm Lambda container. */
const boot = (): { container: Container; app: App } => {
  if (!cached) {
    const container: Container = createContainer(loadEnv(process.env));
    cached = { container, app: createActivityRouter(container) };
  }
  return cached;
};

const isScheduled = (event: LambdaEvent): boolean => event.source === 'aws.events';

/** API Gateway HTTP API (payload v2) requests, plus the EventBridge refresh schedule. */
export const handle = async (event: LambdaEvent): Promise<LambdaResult> => {
  const { container, app } = boot();

  if (event.source === PUSH_EVENT_SOURCE) {
    const res: Result<ActivitySnapshot | null> = await container.activityService.processPush();
    if (!res.ok) container.logger.error('push processing failed', { error: res.error.message });
    return { statusCode: res.ok ? 200 : 500, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: res.ok }) };
  }

  if (isScheduled(event)) {
    const res: Result<ActivitySnapshot | null> = await container.activityService.refresh(RefreshDepth.Deep, false);
    if (!res.ok) container.logger.error('scheduled refresh failed', { error: res.error.message });
    return {
      statusCode: res.ok ? 200 : 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: res.ok }),
    };
  }

  try {
    const method: string = event.requestContext?.http?.method ?? 'GET';
    const query: string = event.rawQueryString ? `?${event.rawQueryString}` : '';
    const headers: Headers = new Headers();
    for (const [key, value] of Object.entries(event.headers ?? {})) {
      if (value !== undefined) headers.set(key, value);
    }
    const init: RequestInit = { method, headers };
    if (method !== 'GET' && method !== 'HEAD' && event.body) {
      init.body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    }
    const response: Response = await app.handle(new Request(`https://lambda.local${event.rawPath ?? '/'}${query}`, init));
    const out: Record<string, string> = {};
    response.headers.forEach((value: string, key: string): void => {
      out[key] = value;
    });
    return { statusCode: response.status, headers: out, body: await response.text() };
  } catch (error: unknown) {
    container.logger.error('unhandled request error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};

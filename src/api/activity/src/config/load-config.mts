import { Value } from '@sinclair/typebox/value';
import { EnvSchema } from '../schemas/index.mjs';
import type { AppConfig } from '../interfaces/index.mjs';
import type { Env } from '../types/index.mjs';

/** Validates the process environment with TypeBox. Throws on bad config: that is unrecoverable. */
export const loadEnv = (source: Record<string, string | undefined>): Env =>
  Value.Parse(EnvSchema, { ...source });

export const toAppConfig = (env: Env): AppConfig => ({
  login: env.GITHUB_LOGIN,
  tableName: env.TABLE_NAME,
  allowedOrigins: env.ALLOWED_ORIGINS.split(',')
    .map((origin: string): string => origin.trim())
    .filter((origin: string): boolean => origin.length > 0),
  timezone: env.ACTIVITY_TIMEZONE,
  liveEventTtlDays: env.LIVE_EVENT_TTL_DAYS,
  refreshDebounceSeconds: env.REFRESH_DEBOUNCE_SECONDS,
  logLevel: env.LOG_LEVEL,
  secretArn: env.GITHUB_APP_SECRET_ARN ?? null,
  functionName: env.AWS_LAMBDA_FUNCTION_NAME ?? null,
});

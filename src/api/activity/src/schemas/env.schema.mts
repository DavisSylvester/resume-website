import { Type } from '@sinclair/typebox';

export const EnvSchema = Type.Object({
  GITHUB_LOGIN: Type.String({ minLength: 1 }),
  TABLE_NAME: Type.String({ minLength: 1 }),
  /** Secrets Manager ARN holding AppCredentials JSON. Omit locally and use the GITHUB_APP_* vars. */
  GITHUB_APP_SECRET_ARN: Type.Optional(Type.String()),
  GITHUB_APP_ID: Type.Optional(Type.String()),
  GITHUB_APP_INSTALLATION_ID: Type.Optional(Type.String()),
  GITHUB_APP_PRIVATE_KEY: Type.Optional(Type.String()),
  GITHUB_WEBHOOK_SECRET: Type.Optional(Type.String()),
  ALLOWED_ORIGINS: Type.String({
    default: 'https://www.dsylvester.io,https://www.dsylvester.ai,http://localhost:4200',
  }),
  ACTIVITY_TIMEZONE: Type.String({ default: 'America/Chicago' }),
  LIVE_EVENT_TTL_DAYS: Type.Integer({ minimum: 1, default: 30 }),
  REFRESH_DEBOUNCE_SECONDS: Type.Integer({ minimum: 0, default: 60 }),
  LOG_LEVEL: Type.Union(
    [Type.Literal('error'), Type.Literal('warn'), Type.Literal('info'), Type.Literal('debug')],
    { default: 'info' },
  ),
});

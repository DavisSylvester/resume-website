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
  AWS_LAMBDA_FUNCTION_NAME: Type.Optional(Type.String()),
  /** Secrets Manager ARN holding ContactSecrets JSON. Omit locally and use the per-channel vars below. */
  CONTACT_SECRET_ARN: Type.Optional(Type.String()),
  CONTACT_EMAIL_TO: Type.String({ default: 'dsylvesteriii@gmail.com' }),
  /** E.164; also the WhatsApp number that receives contact requests. */
  CONTACT_PHONE_TO: Type.String({ default: '+12142231413' }),
  CONTACT_RATE_LIMIT_PER_HOUR: Type.Integer({ minimum: 1, default: 5 }),
  RESEND_API_KEY: Type.Optional(Type.String()),
  CONTACT_EMAIL_FROM: Type.Optional(Type.String()),
  CONTACT_SMS_ORIGINATION_IDENTITY: Type.Optional(Type.String()),
  CONTACT_WHATSAPP_PHONE_NUMBER_ID: Type.Optional(Type.String()),
  CONTACT_WHATSAPP_TEMPLATE: Type.Optional(Type.String()),
  CONTACT_WHATSAPP_TEMPLATE_LANGUAGE: Type.Optional(Type.String()),
  TELEGRAM_BOT_TOKEN: Type.Optional(Type.String()),
  TELEGRAM_CHAT_ID: Type.Optional(Type.String()),
  SLACK_WEBHOOK_URL: Type.Optional(Type.String()),
  TEAMS_WEBHOOK_URL: Type.Optional(Type.String()),
  LOG_LEVEL: Type.Union(
    [Type.Literal('error'), Type.Literal('warn'), Type.Literal('info'), Type.Literal('debug')],
    { default: 'info' },
  ),
});

import { Type } from '@sinclair/typebox';

export const ContactReasonSchema = Type.Union([
  Type.Literal('consulting'),
  Type.Literal('resume'),
  Type.Literal('employment'),
]);

/** How the visitor wants to be answered. `replyTo` holds the matching id, number or address. */
export const ReplyChannelSchema = Type.Union([Type.Literal('whatsapp'), Type.Literal('sms'), Type.Literal('email')]);

/** Body of `POST /contact`. Channel-specific `replyTo` rules are checked by the service. */
export const ContactRequestSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  reason: ContactReasonSchema,
  replyVia: ReplyChannelSchema,
  replyTo: Type.String({ minLength: 3, maxLength: 254 }),
  company: Type.Optional(Type.String({ maxLength: 120 })),
  message: Type.String({ minLength: 1, maxLength: 4000 }),
  /** Honeypot: hidden in the form, so only bots fill it. */
  website: Type.Optional(Type.String({ maxLength: 500 })),
});

/**
 * The contact secret in Secrets Manager (channel credentials and settings). Every field is optional: a channel whose
 * credentials are missing (or still `REPLACE_ME`) is skipped rather than failing the request.
 */
export const ContactSecretsSchema = Type.Object({
  /** AWS End User Messaging SMS origination identity: phone number id/ARN or pool id. */
  smsOriginationIdentity: Type.Optional(Type.String()),
  /** AWS End User Messaging Social WhatsApp phone number id (`phone-number-id-…`). */
  whatsAppPhoneNumberId: Type.Optional(Type.String()),
  /** Approved Meta template with two body parameters; without it only free-form text is sent. */
  whatsAppTemplateName: Type.Optional(Type.String()),
  whatsAppTemplateLanguage: Type.Optional(Type.String()),
  telegramBotToken: Type.Optional(Type.String()),
  telegramChatId: Type.Optional(Type.String()),
  slackWebhookUrl: Type.Optional(Type.String()),
  teamsWebhookUrl: Type.Optional(Type.String()),
});

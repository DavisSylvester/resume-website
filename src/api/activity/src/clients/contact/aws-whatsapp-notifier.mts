import { SendWhatsAppMessageCommand } from '@aws-sdk/client-socialmessaging';
import { REPLY_LABEL, shortTextOf, subjectOf } from '../../services/contact/format.mjs';
import { fail, ok, NotifyChannel, NotifyOutcome } from '../../types/index.mjs';
import type { ContactConfig, ContactMessage, ContactSecretsProvider, Notifier, WhatsAppClient } from '../../interfaces/index.mjs';
import type { ContactSecrets, Result } from '../../types/index.mjs';

const META_API_VERSION: string = 'v20.0';
const MAX_TEXT_LENGTH: number = 1500;
/** Meta caps a template body parameter and rejects newlines, tabs and runs of spaces in it. */
const MAX_PARAM_LENGTH: number = 900;

const templateParam = (value: string, max: number): string => {
  const flat: string = value.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
};

/**
 * WhatsApp to Davis's phone through AWS End User Messaging Social, authenticated by the Lambda
 * role. Meta only delivers free-form text inside the 24-hour window after the recipient last
 * wrote to the business number, so with `whatsAppTemplateName` set it sends that approved
 * template instead: body parameter {{1}} is the subject, {{2}} the reply channel and message.
 */
export class AwsWhatsAppNotifier implements Notifier {

  public readonly channel: NotifyChannel = NotifyChannel.WhatsApp;
  private readonly secrets: ContactSecretsProvider;
  private readonly config: ContactConfig;
  private readonly client: WhatsAppClient;

  public constructor(secrets: ContactSecretsProvider, config: ContactConfig, client: WhatsAppClient) {
    this.secrets = secrets;
    this.config = config;
    this.client = client;
  }

  public async send(m: ContactMessage): Promise<Result<NotifyOutcome>> {
    const s: Result<ContactSecrets> = await this.secrets.get();
    if (!s.ok) return fail(s.error);
    const { whatsAppPhoneNumberId: phoneNumberId, whatsAppTemplateName: template } = s.value;
    if (!phoneNumberId) return ok(NotifyOutcome.Skipped);

    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to: this.config.phoneTo,
      ...(template
        ? {
          type: 'template',
          template: {
            name: template,
            language: { code: s.value.whatsAppTemplateLanguage ?? 'en_US' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: templateParam(subjectOf(m), 200) },
                  {
                    type: 'text',
                    text: templateParam(`Reply via ${REPLY_LABEL[m.replyVia]}: ${m.replyTo}. ${m.message}`, MAX_PARAM_LENGTH),
                  },
                ],
              },
            ],
          },
        }
        : { type: 'text', text: { body: shortTextOf(m, MAX_TEXT_LENGTH), preview_url: false } }),
    };

    try {
      await this.client.send(
        new SendWhatsAppMessageCommand({
          originationPhoneNumberId: phoneNumberId,
          message: new TextEncoder().encode(JSON.stringify(payload)),
          metaApiVersion: META_API_VERSION,
        }),
      );
      return ok(NotifyOutcome.Sent);
    } catch (error: unknown) {
      return fail(new Error(`AWS WhatsApp request failed: ${error instanceof Error ? error.message : String(error)}`));
    }
  }
}

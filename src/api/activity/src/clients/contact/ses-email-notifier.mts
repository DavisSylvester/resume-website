import { SendEmailCommand } from '@aws-sdk/client-sesv2';
import { subjectOf, textOf } from '../../services/contact/format.mjs';
import { fail, ok, NotifyChannel, NotifyOutcome, ReplyChannel } from '../../types/index.mjs';
import type { ContactConfig, ContactMessage, EmailClient, Notifier } from '../../interfaces/index.mjs';
import type { Result } from '../../types/index.mjs';

/**
 * Email through Amazon SES, authenticated by the Lambda role. The sender must be on an SES-verified
 * domain; without `CONTACT_EMAIL_FROM` the channel is skipped. Replies go straight to the visitor
 * when they chose email.
 */
export class SesEmailNotifier implements Notifier {

  public readonly channel: NotifyChannel = NotifyChannel.Email;
  private readonly config: ContactConfig;
  private readonly client: EmailClient;

  public constructor(config: ContactConfig, client: EmailClient) {
    this.config = config;
    this.client = client;
  }

  public async send(m: ContactMessage): Promise<Result<NotifyOutcome>> {
    const from: string | null = this.config.emailFrom;
    if (!from) return ok(NotifyOutcome.Skipped);

    try {
      await this.client.send(
        new SendEmailCommand({
          FromEmailAddress: from,
          Destination: { ToAddresses: [this.config.emailTo] },
          ...(m.replyVia === ReplyChannel.Email ? { ReplyToAddresses: [m.replyTo] } : {}),
          Content: {
            Simple: {
              Subject: { Data: `[dsylvester.io] ${subjectOf(m)}`, Charset: 'UTF-8' },
              Body: { Text: { Data: textOf(m), Charset: 'UTF-8' } },
            },
          },
        }),
      );
      return ok(NotifyOutcome.Sent);
    } catch (error: unknown) {
      return fail(new Error(`SES request failed: ${error instanceof Error ? error.message : String(error)}`));
    }
  }
}

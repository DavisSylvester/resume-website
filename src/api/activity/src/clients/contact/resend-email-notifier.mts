import { jsonInit, send } from './post.mjs';
import { subjectOf, textOf } from '../../services/contact/format.mjs';
import { fail, ok, NotifyChannel, NotifyOutcome, ReplyChannel } from '../../types/index.mjs';
import type { FetchFn } from '../github-app-client.mjs';
import type { ContactConfig, ContactMessage, ContactSecretsProvider, Notifier } from '../../interfaces/index.mjs';
import type { ContactSecrets, Result } from '../../types/index.mjs';

/** Email via Resend. Replies go straight to the visitor when they chose email. */
export class ResendEmailNotifier implements Notifier {

  public readonly channel: NotifyChannel = NotifyChannel.Email;
  private readonly secrets: ContactSecretsProvider;
  private readonly config: ContactConfig;
  private readonly fetchFn: FetchFn;

  public constructor(secrets: ContactSecretsProvider, config: ContactConfig, fetchFn: FetchFn) {
    this.secrets = secrets;
    this.config = config;
    this.fetchFn = fetchFn;
  }

  public async send(m: ContactMessage): Promise<Result<NotifyOutcome>> {
    const s: Result<ContactSecrets> = await this.secrets.get();
    if (!s.ok) return fail(s.error);
    const { resendApiKey, emailFrom } = s.value;
    if (!resendApiKey || !emailFrom) return ok(NotifyOutcome.Skipped);

    return send(
      this.fetchFn,
      'https://api.resend.com/emails',
      jsonInit(
        {
          from: emailFrom,
          to: [this.config.emailTo],
          subject: `[dsylvester.io] ${subjectOf(m)}`,
          text: textOf(m),
          ...(m.replyVia === ReplyChannel.Email ? { reply_to: m.replyTo } : {}),
        },
        { authorization: `Bearer ${resendApiKey}` },
      ),
      'Resend',
    );
  }
}

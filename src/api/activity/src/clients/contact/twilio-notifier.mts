import { send } from './post.mjs';
import { shortTextOf } from '../../services/contact/format.mjs';
import { fail, ok, NotifyChannel, NotifyOutcome } from '../../types/index.mjs';
import type { FetchFn } from '../github-app-client.mjs';
import type { ContactConfig, ContactMessage, ContactSecretsProvider, Notifier } from '../../interfaces/index.mjs';
import type { ContactSecrets, Result } from '../../types/index.mjs';

export type TwilioChannel = typeof NotifyChannel.Sms | typeof NotifyChannel.WhatsApp;

/** Keeps an SMS to a few segments; WhatsApp allows more. */
const MAX_LENGTH: Record<TwilioChannel, number> = { sms: 600, whatsapp: 1500 };

/** SMS or WhatsApp to Davis's phone through Twilio's Messages API. */
export class TwilioNotifier implements Notifier {

  public readonly channel: TwilioChannel;
  private readonly secrets: ContactSecretsProvider;
  private readonly config: ContactConfig;
  private readonly fetchFn: FetchFn;

  public constructor(channel: TwilioChannel, secrets: ContactSecretsProvider, config: ContactConfig, fetchFn: FetchFn) {
    this.channel = channel;
    this.secrets = secrets;
    this.config = config;
    this.fetchFn = fetchFn;
  }

  public async send(m: ContactMessage): Promise<Result<NotifyOutcome>> {
    const s: Result<ContactSecrets> = await this.secrets.get();
    if (!s.ok) return fail(s.error);
    const { twilioAccountSid: sid, twilioAuthToken: token } = s.value;
    const isWhatsApp: boolean = this.channel === NotifyChannel.WhatsApp;
    const from: string | undefined = isWhatsApp ? s.value.twilioWhatsAppFrom : s.value.twilioSmsFrom;
    if (!sid || !token || !from) return ok(NotifyOutcome.Skipped);

    const prefix: string = isWhatsApp ? 'whatsapp:' : '';
    const form: URLSearchParams = new URLSearchParams({
      From: `${prefix}${from.replace(/^whatsapp:/, '')}`,
      To: `${prefix}${this.config.phoneTo}`,
      Body: shortTextOf(m, MAX_LENGTH[this.channel]),
    });

    return send(
      this.fetchFn,
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        },
        body: form.toString(),
      },
      `Twilio ${this.channel}`,
    );
  }
}

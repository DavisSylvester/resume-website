import { SendTextMessageCommand } from '@aws-sdk/client-pinpoint-sms-voice-v2';
import { shortTextOf } from '../../services/contact/format.mjs';
import { fail, ok, NotifyChannel, NotifyOutcome } from '../../types/index.mjs';
import type { ContactConfig, ContactMessage, ContactSecretsProvider, Notifier, SmsClient } from '../../interfaces/index.mjs';
import type { ContactSecrets, Result } from '../../types/index.mjs';

/** Keeps an SMS to a few segments. */
const MAX_LENGTH: number = 600;
/** Required by the toll-free registration: every message carries opt-out wording, as in its samples. */
export const SMS_OPT_OUT: string = 'Reply STOP to opt out.';

/**
 * SMS to Davis's phone through AWS End User Messaging SMS. Authenticated by the Lambda role, so
 * the only setting is the origination identity (a registered toll-free/10DLC number, its ARN,
 * or a pool). Without one the channel is skipped.
 */
export class AwsSmsNotifier implements Notifier {

  public readonly channel: NotifyChannel = NotifyChannel.Sms;
  private readonly secrets: ContactSecretsProvider;
  private readonly config: ContactConfig;
  private readonly client: SmsClient;

  public constructor(secrets: ContactSecretsProvider, config: ContactConfig, client: SmsClient) {
    this.secrets = secrets;
    this.config = config;
    this.client = client;
  }

  public async send(m: ContactMessage): Promise<Result<NotifyOutcome>> {
    const s: Result<ContactSecrets> = await this.secrets.get();
    if (!s.ok) return fail(s.error);
    const origination: string | undefined = s.value.smsOriginationIdentity;
    if (!origination) return ok(NotifyOutcome.Skipped);

    try {
      await this.client.send(
        new SendTextMessageCommand({
          DestinationPhoneNumber: this.config.phoneTo,
          OriginationIdentity: origination,
          MessageBody: `${shortTextOf(m, MAX_LENGTH - SMS_OPT_OUT.length - 1)}\n${SMS_OPT_OUT}`,
          MessageType: 'TRANSACTIONAL',
        }),
      );
      return ok(NotifyOutcome.Sent);
    } catch (error: unknown) {
      return fail(new Error(`AWS SMS request failed: ${error instanceof Error ? error.message : String(error)}`));
    }
  }
}

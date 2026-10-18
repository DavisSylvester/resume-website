import { cleanSecrets } from './clean-secrets.mjs';
import { ok } from '../../types/index.mjs';
import type { ContactSecretsProvider } from '../../interfaces/index.mjs';
import type { ContactSecrets, Env, Result } from '../../types/index.mjs';

/** Local development: channel credentials from environment variables. */
export class EnvContactSecretsProvider implements ContactSecretsProvider {

  private readonly env: Env;

  public constructor(env: Env) {
    this.env = env;
  }

  public async get(): Promise<Result<ContactSecrets>> {
    return ok(
      cleanSecrets({
        resendApiKey: this.env.RESEND_API_KEY,
        emailFrom: this.env.CONTACT_EMAIL_FROM,
        twilioAccountSid: this.env.TWILIO_ACCOUNT_SID,
        twilioAuthToken: this.env.TWILIO_AUTH_TOKEN,
        twilioSmsFrom: this.env.TWILIO_SMS_FROM,
        twilioWhatsAppFrom: this.env.TWILIO_WHATSAPP_FROM,
        telegramBotToken: this.env.TELEGRAM_BOT_TOKEN,
        telegramChatId: this.env.TELEGRAM_CHAT_ID,
        slackWebhookUrl: this.env.SLACK_WEBHOOK_URL,
        teamsWebhookUrl: this.env.TEAMS_WEBHOOK_URL,
      }),
    );
  }
}

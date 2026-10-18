import { jsonInit, send } from './post.mjs';
import { textOf } from '../../services/contact/format.mjs';
import { fail, ok, NotifyChannel, NotifyOutcome } from '../../types/index.mjs';
import type { FetchFn } from '../github-app-client.mjs';
import type { ContactMessage, ContactSecretsProvider, Notifier } from '../../interfaces/index.mjs';
import type { ContactSecrets, Result } from '../../types/index.mjs';

/** Telegram Bot API. Plain text (no parse_mode), so visitor input needs no escaping. */
export class TelegramNotifier implements Notifier {

  public readonly channel: NotifyChannel = NotifyChannel.Telegram;
  private readonly secrets: ContactSecretsProvider;
  private readonly fetchFn: FetchFn;

  public constructor(secrets: ContactSecretsProvider, fetchFn: FetchFn) {
    this.secrets = secrets;
    this.fetchFn = fetchFn;
  }

  public async send(m: ContactMessage): Promise<Result<NotifyOutcome>> {
    const s: Result<ContactSecrets> = await this.secrets.get();
    if (!s.ok) return fail(s.error);
    const { telegramBotToken: token, telegramChatId: chatId } = s.value;
    if (!token || !chatId) return ok(NotifyOutcome.Skipped);

    return send(
      this.fetchFn,
      `https://api.telegram.org/bot${token}/sendMessage`,
      jsonInit({ chat_id: chatId, text: textOf(m).slice(0, 4096), disable_web_page_preview: true }),
      'Telegram',
    );
  }
}

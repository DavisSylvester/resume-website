import { jsonInit, send } from './post.mjs';
import { factsOf, subjectOf, textOf } from '../../services/contact/format.mjs';
import { fail, ok, NotifyChannel, NotifyOutcome } from '../../types/index.mjs';
import type { FetchFn } from '../github-app-client.mjs';
import type { ContactMessage, ContactSecretsProvider, Notifier } from '../../interfaces/index.mjs';
import type { ContactSecrets, Result } from '../../types/index.mjs';

/** Slack mrkdwn treats &, < and > as control characters. */
const escape = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Slack incoming webhook (Block Kit, with `text` as the notification fallback). */
export class SlackNotifier implements Notifier {

  public readonly channel: NotifyChannel = NotifyChannel.Slack;
  private readonly secrets: ContactSecretsProvider;
  private readonly fetchFn: FetchFn;

  public constructor(secrets: ContactSecretsProvider, fetchFn: FetchFn) {
    this.secrets = secrets;
    this.fetchFn = fetchFn;
  }

  public async send(m: ContactMessage): Promise<Result<NotifyOutcome>> {
    const s: Result<ContactSecrets> = await this.secrets.get();
    if (!s.ok) return fail(s.error);
    const url: string | undefined = s.value.slackWebhookUrl;
    if (!url) return ok(NotifyOutcome.Skipped);

    const payload: Record<string, unknown> = {
      text: textOf(m).slice(0, 3000),
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: subjectOf(m).slice(0, 150) } },
        {
          type: 'section',
          fields: factsOf(m).map(([label, value]: [string, string]): Record<string, string> => ({
            type: 'mrkdwn',
            text: `*${label}*\n${escape(value)}`.slice(0, 2000),
          })),
        },
        { type: 'section', text: { type: 'mrkdwn', text: escape(m.message).slice(0, 3000) } },
        { type: 'context', elements: [{ type: 'mrkdwn', text: `Ref ${m.id}` }] },
      ],
    };
    return send(this.fetchFn, url, jsonInit(payload), 'Slack');
  }
}

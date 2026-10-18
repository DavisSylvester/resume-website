import { jsonInit, send } from './post.mjs';
import { factsOf, subjectOf } from '../../services/contact/format.mjs';
import { fail, ok, NotifyChannel, NotifyOutcome } from '../../types/index.mjs';
import type { FetchFn } from '../github-app-client.mjs';
import type { ContactMessage, ContactSecretsProvider, Notifier } from '../../interfaces/index.mjs';
import type { ContactSecrets, Result } from '../../types/index.mjs';

/**
 * Microsoft Teams via a Workflows "When a Teams webhook request is received" URL
 * (the replacement for Office 365 connectors). The payload is an Adaptive Card message.
 */
export class TeamsNotifier implements Notifier {

  public readonly channel: NotifyChannel = NotifyChannel.Teams;
  private readonly secrets: ContactSecretsProvider;
  private readonly fetchFn: FetchFn;

  public constructor(secrets: ContactSecretsProvider, fetchFn: FetchFn) {
    this.secrets = secrets;
    this.fetchFn = fetchFn;
  }

  public async send(m: ContactMessage): Promise<Result<NotifyOutcome>> {
    const s: Result<ContactSecrets> = await this.secrets.get();
    if (!s.ok) return fail(s.error);
    const url: string | undefined = s.value.teamsWebhookUrl;
    if (!url) return ok(NotifyOutcome.Skipped);

    const card: Record<string, unknown> = {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        { type: 'TextBlock', text: subjectOf(m), weight: 'Bolder', size: 'Medium', wrap: true },
        {
          type: 'FactSet',
          facts: factsOf(m).map(([title, value]: [string, string]): Record<string, string> => ({ title, value })),
        },
        { type: 'TextBlock', text: m.message, wrap: true, separator: true },
        { type: 'TextBlock', text: `Ref ${m.id}`, isSubtle: true, size: 'Small' },
      ],
    };
    return send(
      this.fetchFn,
      url,
      jsonInit({
        type: 'message',
        attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', contentUrl: null, content: card }],
      }),
      'Teams',
    );
  }
}

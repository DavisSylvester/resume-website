/**
 * Channel notifiers: each one is skipped without credentials, and with credentials sends the
 * provider's expected request shape. No network: fetch is a recording fake.
 */
import { describe, expect, test } from 'bun:test';
import type { SendTextMessageCommand, SendTextMessageCommandOutput } from '@aws-sdk/client-pinpoint-sms-voice-v2';
import type { SendWhatsAppMessageCommand, SendWhatsAppMessageCommandOutput } from '@aws-sdk/client-socialmessaging';
import {
  AwsSmsNotifier,
  AwsWhatsAppNotifier,
  cleanSecrets,
  ResendEmailNotifier,
  SlackNotifier,
  TeamsNotifier,
  TelegramNotifier,
} from '../src/clients/index.mjs';
import { validateReplyTo } from '../src/services/contact/validate-reply-to.mjs';
import { ok, NotifyOutcome } from '../src/types/index.mjs';
import type { FetchFn } from '../src/clients/index.mjs';
import type { ContactConfig, ContactMessage, ContactSecretsProvider, SmsClient, WhatsAppClient } from '../src/interfaces/index.mjs';
import type { ContactSecrets, Result } from '../src/types/index.mjs';

interface Call {
  url: string;
  init: RequestInit;
}

const recorder = (status: number = 200): { fetchFn: FetchFn; calls: Call[] } => {
  const calls: Call[] = [];
  const fetchFn: FetchFn = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, init: init ?? {} });
    return new Response(status < 300 ? '{}' : 'nope', { status });
  };
  return { fetchFn, calls };
};

/** Records the commands an AWS SDK client would send; `error` makes every send reject. */
const smsFake = (error?: Error): { client: SmsClient; sent: SendTextMessageCommand[] } => {
  const sent: SendTextMessageCommand[] = [];
  const client: SmsClient = {
    send: async (command: SendTextMessageCommand): Promise<SendTextMessageCommandOutput> => {
      if (error) throw error;
      sent.push(command);
      return { MessageId: 'm1', $metadata: {} };
    },
  };
  return { client, sent };
};

const whatsAppFake = (): { client: WhatsAppClient; sent: SendWhatsAppMessageCommand[] } => {
  const sent: SendWhatsAppMessageCommand[] = [];
  const client: WhatsAppClient = {
    send: async (command: SendWhatsAppMessageCommand): Promise<SendWhatsAppMessageCommandOutput> => {
      sent.push(command);
      return { messageId: 'w1', $metadata: {} };
    },
  };
  return { client, sent };
};

const whatsAppBody = (command: SendWhatsAppMessageCommand | undefined): Record<string, unknown> =>
  JSON.parse(new TextDecoder().decode(command?.input.message)) as Record<string, unknown>;

const secrets = (value: ContactSecrets): ContactSecretsProvider => ({
  get: async (): Promise<Result<ContactSecrets>> => ok(value),
});

const config: ContactConfig = { secretArn: null, emailTo: 'davis@example.com', phoneTo: '+12145550100', rateLimitPerHour: 5 };

const message: ContactMessage = {
  id: 'abc',
  receivedAt: '2026-10-18T15:00:00.000Z',
  name: 'Ada <script>',
  reason: 'employment',
  replyVia: 'email',
  replyTo: 'ada@example.com',
  company: 'Analytical Engines',
  message: 'We are hiring & would love to chat.',
  sourceIp: '1.2.3.4',
};

const bodyOf = (call: Call | undefined): Record<string, unknown> => JSON.parse(String(call?.init.body)) as Record<string, unknown>;

describe('notifiers', () => {
  test('every notifier is skipped when its credentials are missing', async () => {
    const { fetchFn, calls } = recorder();
    const sms = smsFake();
    const wa = whatsAppFake();
    const empty: ContactSecretsProvider = secrets({});
    const all = [
      new ResendEmailNotifier(empty, config, fetchFn),
      new AwsSmsNotifier(empty, config, sms.client),
      new AwsWhatsAppNotifier(empty, config, wa.client),
      new TelegramNotifier(empty, fetchFn),
      new SlackNotifier(empty, fetchFn),
      new TeamsNotifier(empty, fetchFn),
    ];
    for (const n of all) expect(await n.send(message)).toEqual(ok(NotifyOutcome.Skipped));
    expect(calls).toHaveLength(0);
    expect(sms.sent).toHaveLength(0);
    expect(wa.sent).toHaveLength(0);
  });

  test('Resend sends to Davis with reply_to set to the visitor', async () => {
    const { fetchFn, calls } = recorder();
    const res = await new ResendEmailNotifier(secrets({ resendApiKey: 'rk', emailFrom: 'site@dsylvester.io' }), config, fetchFn).send(message);
    expect(res).toEqual(ok(NotifyOutcome.Sent));
    expect(calls[0]?.url).toBe('https://api.resend.com/emails');
    expect(bodyOf(calls[0])).toMatchObject({ to: ['davis@example.com'], reply_to: 'ada@example.com' });
    expect((calls[0]?.init.headers as Record<string, string>)['authorization']).toBe('Bearer rk');
  });

  test('AWS SMS sends a transactional text from the origination identity to Davis', async () => {
    const { client, sent } = smsFake();
    const res = await new AwsSmsNotifier(secrets({ smsOriginationIdentity: 'phone-123' }), config, client).send(message);
    expect(res).toEqual(ok(NotifyOutcome.Sent));
    expect(sent[0]?.input).toMatchObject({
      DestinationPhoneNumber: '+12145550100',
      OriginationIdentity: 'phone-123',
      MessageType: 'TRANSACTIONAL',
    });
    expect((sent[0]?.input.MessageBody ?? '').length).toBeLessThanOrEqual(600);
  });

  test('an AWS SMS error becomes a failed Result', async () => {
    const { client } = smsFake(new Error('ConflictException'));
    const res = await new AwsSmsNotifier(secrets({ smsOriginationIdentity: 'phone-123' }), config, client).send(message);
    expect(!res.ok && res.error.message).toBe('AWS SMS request failed: ConflictException');
  });

  test('AWS WhatsApp sends free-form text when no template is set', async () => {
    const { client, sent } = whatsAppFake();
    await new AwsWhatsAppNotifier(secrets({ whatsAppPhoneNumberId: 'phone-number-id-1' }), config, client).send(message);
    expect(sent[0]?.input.originationPhoneNumberId).toBe('phone-number-id-1');
    expect(whatsAppBody(sent[0])).toMatchObject({ messaging_product: 'whatsapp', to: '+12145550100', type: 'text' });
  });

  test('AWS WhatsApp sends the template with single-line parameters', async () => {
    const { client, sent } = whatsAppFake();
    const multiline: ContactMessage = { ...message, message: 'Line one\n\n\tLine     two' };
    await new AwsWhatsAppNotifier(
      secrets({ whatsAppPhoneNumberId: 'phone-number-id-1', whatsAppTemplateName: 'contact_request' }),
      config,
      client,
    ).send(multiline);

    const body = whatsAppBody(sent[0]) as {
      type: string;
      template: { name: string; language: { code: string }; components: { parameters: { text: string }[] }[] };
    };
    expect(body.type).toBe('template');
    expect(body.template.name).toBe('contact_request');
    expect(body.template.language.code).toBe('en_US');
    const params: string[] = (body.template.components[0]?.parameters ?? []).map((p: { text: string }): string => p.text);
    expect(params[0]).toBe('Employment opportunity from Ada <script>');
    expect(params[1]).toBe('Reply via Email: ada@example.com. Line one Line two');
  });

  test('Telegram posts plain text to the chat', async () => {
    const { fetchFn, calls } = recorder();
    await new TelegramNotifier(secrets({ telegramBotToken: 'bt', telegramChatId: '42' }), fetchFn).send(message);
    expect(calls[0]?.url).toBe('https://api.telegram.org/botbt/sendMessage');
    expect(bodyOf(calls[0])).toMatchObject({ chat_id: '42' });
    expect(bodyOf(calls[0])['parse_mode']).toBeUndefined();
  });

  test('Slack escapes visitor input in mrkdwn blocks', async () => {
    const { fetchFn, calls } = recorder();
    await new SlackNotifier(secrets({ slackWebhookUrl: 'https://hooks.slack.test/x' }), fetchFn).send(message);
    const raw: string = String(calls[0]?.init.body);
    expect(raw).toContain('Ada &lt;script&gt;');
    expect(raw).toContain('hiring &amp; would');
  });

  test('Teams posts an Adaptive Card message', async () => {
    const { fetchFn, calls } = recorder();
    await new TeamsNotifier(secrets({ teamsWebhookUrl: 'https://teams.test/hook' }), fetchFn).send(message);
    const body = bodyOf(calls[0]) as { type: string; attachments: { contentType: string }[] };
    expect(body.type).toBe('message');
    expect(body.attachments[0]?.contentType).toBe('application/vnd.microsoft.card.adaptive');
  });

  test('a provider error becomes a failed Result', async () => {
    const { fetchFn } = recorder(401);
    const res = await new SlackNotifier(secrets({ slackWebhookUrl: 'https://hooks.slack.test/x' }), fetchFn).send(message);
    expect(!res.ok && res.error.message).toContain('Slack responded 401');
  });
});

describe('cleanSecrets', () => {
  test('drops blanks and REPLACE_ME placeholders', () => {
    expect(cleanSecrets({ resendApiKey: 'REPLACE_ME', emailFrom: ' ', slackWebhookUrl: ' https://x ', extra: 3 })).toEqual({
      slackWebhookUrl: 'https://x',
    });
  });
});

describe('validateReplyTo', () => {
  test.each([
    ['email', 'ada@example.com', true],
    ['email', 'ada@', false],
    ['sms', '(214) 555-0100', true],
    ['sms', '+44 20 7946 0958', true],
    ['sms', '555-0100', false],
    ['whatsapp', '+1 214 555 0100', true],
    ['whatsapp', '@ada.lovelace', true],
    ['whatsapp', 'a b', false],
  ] as const)('%s %s -> %p', (channel, value, valid) => {
    expect(validateReplyTo(channel, value) === null).toBe(valid);
  });
});

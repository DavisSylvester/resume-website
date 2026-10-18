/**
 * Channel notifiers: each one is skipped without credentials, and with credentials sends the
 * provider's expected request shape. No network: fetch is a recording fake.
 */
import { describe, expect, test } from 'bun:test';
import {
  cleanSecrets,
  ResendEmailNotifier,
  SlackNotifier,
  TeamsNotifier,
  TelegramNotifier,
  TwilioNotifier,
} from '../src/clients/index.mjs';
import { validateReplyTo } from '../src/services/contact/validate-reply-to.mjs';
import { ok, NotifyOutcome } from '../src/types/index.mjs';
import type { FetchFn } from '../src/clients/index.mjs';
import type { ContactConfig, ContactMessage, ContactSecretsProvider } from '../src/interfaces/index.mjs';
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
    const empty: ContactSecretsProvider = secrets({});
    const all = [
      new ResendEmailNotifier(empty, config, fetchFn),
      new TwilioNotifier('sms', empty, config, fetchFn),
      new TwilioNotifier('whatsapp', empty, config, fetchFn),
      new TelegramNotifier(empty, fetchFn),
      new SlackNotifier(empty, fetchFn),
      new TeamsNotifier(empty, fetchFn),
    ];
    for (const n of all) expect(await n.send(message)).toEqual(ok(NotifyOutcome.Skipped));
    expect(calls).toHaveLength(0);
  });

  test('Resend sends to Davis with reply_to set to the visitor', async () => {
    const { fetchFn, calls } = recorder();
    const res = await new ResendEmailNotifier(secrets({ resendApiKey: 'rk', emailFrom: 'site@dsylvester.io' }), config, fetchFn).send(message);
    expect(res).toEqual(ok(NotifyOutcome.Sent));
    expect(calls[0]?.url).toBe('https://api.resend.com/emails');
    expect(bodyOf(calls[0])).toMatchObject({ to: ['davis@example.com'], reply_to: 'ada@example.com' });
    expect((calls[0]?.init.headers as Record<string, string>)['authorization']).toBe('Bearer rk');
  });

  test('Twilio WhatsApp prefixes both numbers; SMS does not', async () => {
    const creds: ContactSecrets = { twilioAccountSid: 'AC1', twilioAuthToken: 't', twilioSmsFrom: '+15550001111', twilioWhatsAppFrom: '+14155238886' };
    const { fetchFn, calls } = recorder();
    await new TwilioNotifier('whatsapp', secrets(creds), config, fetchFn).send(message);
    await new TwilioNotifier('sms', secrets(creds), config, fetchFn).send(message);

    const wa: URLSearchParams = new URLSearchParams(String(calls[0]?.init.body));
    const sms: URLSearchParams = new URLSearchParams(String(calls[1]?.init.body));
    expect(calls[0]?.url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json');
    expect([wa.get('From'), wa.get('To')]).toEqual(['whatsapp:+14155238886', 'whatsapp:+12145550100']);
    expect([sms.get('From'), sms.get('To')]).toEqual(['+15550001111', '+12145550100']);
    expect((sms.get('Body') ?? '').length).toBeLessThanOrEqual(600);
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

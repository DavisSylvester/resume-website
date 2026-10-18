# Contact form

The navbar **Contact** button (desktop bar and phone drawer) opens a modal. A visitor picks
what they want (consulting services, resume request, employment), how Davis should reply
(WhatsApp, SMS or email) and enters the matching WhatsApp number or username, mobile number
or email address. Submitting posts to the API, which sends the request to Davis on
**every configured channel at once**: email, SMS, WhatsApp, Telegram, Slack and Teams.

## Flow

```
navbar Contact ─▶ ContactDialogService.open() ─▶ <app-contact-dialog> (<dialog> + reactive form)
                                                   │ POST {api}/contact
                                                   ▼
API Gateway  POST /contact ─▶ gh-app-activity-api-prod (same Lambda as /activity)
  router  ─▶ DefaultContactService
               1. honeypot field filled  → 202, nothing sent
               2. reply-to checked against the channel → 400
               3. per-IP count in DynamoDB, 5 / hour → 429
               4. audit copy saved (pk=CONTACT, kept 365 days)
               5. all notifiers in parallel
                    ≥1 sent → 202 { id, delivered: [...] }
                    all failed → 502, none configured → 503
```

## API

`POST /contact` with `content-type: application/json`:

| Field      | Rules                                                              |
|------------|--------------------------------------------------------------------|
| `name`     | 1–100 chars                                                        |
| `reason`   | `consulting` \| `resume` \| `employment`                           |
| `replyVia` | `whatsapp` \| `sms` \| `email`                                     |
| `replyTo`  | email address; mobile number (10–15 digits); WhatsApp number or `@username` |
| `company`  | optional, ≤120 chars                                               |
| `message`  | 1–4000 chars                                                       |
| `website`  | honeypot, must be empty                                            |

Errors return `{ code, message }`, where `code` is `invalid`, `rate_limited`, `not_configured` or `delivery_failed`.
The UI shows `message` to the visitor. Schema violations come back as Elysia's 422.

## Where Davis receives it

Recipients are Lambda environment variables set in `infrastructure/cdk/lib/activity-api.ts`:
`CONTACT_EMAIL_TO=dsylvesteriii@gmail.com` and `CONTACT_PHONE_TO=+12142231413` (SMS and WhatsApp).

Provider credentials live in the Secrets Manager secret **`gh-app-contact-prod`**, which CDK
creates with every value set to `REPLACE_ME`. **A channel whose values are missing or still
`REPLACE_ME` is skipped**, so the channels can be turned on one at a time.

| Channel  | Provider | Secret keys | Setup |
|----------|----------|-------------|-------|
| Email    | Resend | `resendApiKey`, `emailFrom` | Verify a sending domain in Resend (e.g. `dsylvester.io`); `emailFrom` like `Website <contact@dsylvester.io>`. Replies go to the visitor when they chose email. |
| SMS      | Twilio | `twilioAccountSid`, `twilioAuthToken`, `twilioSmsFrom` | A Twilio number in E.164. US numbers need A2P 10DLC or toll-free verification before carriers deliver. |
| WhatsApp | Twilio | same SID/token + `twilioWhatsAppFrom` | Sandbox (`+14155238886`) works for testing once you've joined it from your phone, but sandbox sessions expire. Production needs an approved WhatsApp sender. |
| Telegram | Bot API | `telegramBotToken`, `telegramChatId` | Create a bot with @BotFather, message it, then read `chat.id` from `https://api.telegram.org/bot<token>/getUpdates`. |
| Slack    | Incoming webhook | `slackWebhookUrl` | Slack app → Incoming Webhooks → add to a channel. |
| Teams    | Workflows webhook | `teamsWebhookUrl` | In the channel: Workflows → "Post to a channel when a webhook request is received". The payload is an Adaptive Card. |

Set the secret (values from your own password manager; never commit them):

```bash
aws secretsmanager put-secret-value --profile dsylvesteriii \
  --secret-id gh-app-contact-prod \
  --secret-string file://contact-secret.json   # delete the file afterwards
```

The Lambda caches the secret for 15 minutes, so a change shows up within that window (or on a cold start).

## Local development

```bash
cd src/api/activity
SLACK_WEBHOOK_URL=... TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... bun dev.mts   # :3100
cd src/ui && npx ng serve                                                        # :4200, posts to :3100
```

Locally the channel credentials come from env vars (`RESEND_API_KEY`, `CONTACT_EMAIL_FROM`,
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`, `TWILIO_WHATSAPP_FROM`,
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SLACK_WEBHOOK_URL`, `TEAMS_WEBHOOK_URL`), and the
rate limit and audit log are in memory. Every local request shares the source IP `local`, so raise
`CONTACT_RATE_LIMIT_PER_HOUR` when testing repeatedly.

## Code map

- UI: `src/ui/src/app/contact/` (options, API service, open/close service, interfaces) and
  `src/ui/src/app/components/contact-dialog/`
- API: `src/api/activity/src/services/contact/`, `src/clients/contact/` (one notifier per channel),
  `src/repositories/*contact-repository.mts`, `POST /contact` in `src/routes/activity-router.mts`
- Infra: `ContactSecret` and the `/contact` route in `infrastructure/cdk/lib/activity-api.ts`

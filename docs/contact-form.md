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
| Email    | Amazon SES | none (env `CONTACT_EMAIL_FROM`) | No keys: the role is allowed `ses:SendEmail` on the `dsylvester.ai` identity, which is already verified with DKIM, and the account has SES production access. CDK sets the sender to `Davis Sylvester website <contact@dsylvester.ai>`. Replies go to the visitor when they chose email. |
| SMS      | AWS End User Messaging SMS | `smsOriginationIdentity` | No keys: the Lambda role is allowed `sms-voice:SendTextMessage`. Request a toll-free number in us-east-1 (End User Messaging → Phone numbers) and complete its registration; carriers block unregistered US traffic. The value is the phone number id/ARN or a pool id. While the account is in the SMS sandbox, also verify `CONTACT_PHONE_TO` as a destination. |
| WhatsApp | AWS End User Messaging Social | `whatsAppPhoneNumberId`, optional `whatsAppTemplateName`, `whatsAppTemplateLanguage` (default `en_US`) | No keys: the role is allowed `social-messaging:SendWhatsAppMessage`. In End User Messaging → WhatsApp, link a WhatsApp Business Account and a sender number (not the number that receives, `CONTACT_PHONE_TO`); the value is its `phone-number-id-…`. Meta only delivers free-form text within 24 h of your last message to that number, so create a Utility template (e.g. `contact_request`, body `New contact request: {{1}}. {{2}}`) and set its name; the API fills {{1}} with the subject and {{2}} with the reply channel and message. |
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

Locally the channel settings come from env vars (`CONTACT_EMAIL_FROM`,
`CONTACT_SMS_ORIGINATION_IDENTITY`, `CONTACT_WHATSAPP_PHONE_NUMBER_ID`, `CONTACT_WHATSAPP_TEMPLATE`,
`CONTACT_WHATSAPP_TEMPLATE_LANGUAGE`, with AWS credentials from your profile for email, SMS and WhatsApp,
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SLACK_WEBHOOK_URL`, `TEAMS_WEBHOOK_URL`), and the
rate limit and audit log are in memory. Every local request shares the source IP `local`, so raise
`CONTACT_RATE_LIMIT_PER_HOUR` when testing repeatedly.

## Code map

- UI: `src/ui/src/app/contact/` (options, API service, open/close service, interfaces) and
  `src/ui/src/app/components/contact-dialog/`
- API: `src/api/activity/src/services/contact/`, `src/clients/contact/` (one notifier per channel),
  `src/repositories/*contact-repository.mts`, `POST /contact` in `src/routes/activity-router.mts`
- Infra: `ContactSecret`, the SES and End User Messaging IAM grants and the `/contact` route in
  `infrastructure/cdk/lib/activity-api.ts`. Don't edit the secret's initial JSON there: a template
  change rewrites the live secret. Add new keys with `put-secret-value` instead.

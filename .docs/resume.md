# Resume

## Where to pick up

The contact form is live on two channels: **email** (Amazon SES, from `contact@dsylvester.ai`,
PR #14) and **Telegram** (@davis_resume_web_bot; token is `TELEGRAM_TOKEN` in the gitignored
repo `.env`, and it plus the chat id are in `gh-app-contact-prod`). The last live test returned
`delivered: ["email","telegram"]`, and the user confirmed the Telegram message came from the new bot.

SES mail reaches Gmail's inbox but lands in the **Updates** tab, which the user doesn't watch;
a Gmail filter to Primary is the fix (in todo). Next, SMS and WhatsApp (AWS End User Messaging) are
blocked on the user's number registration and carrier/Meta review; Slack and Teams are still
`REPLACE_ME`. Other open items are in `.docs/todo.md`.

Test request (counts toward the 5/hour per-IP limit; sends a real message on every live channel):

```bash
curl -s -X POST https://etgzi1pkz8.execute-api.us-east-1.amazonaws.com/contact \
  -H 'content-type: application/json' -H 'origin: https://www.dsylvester.io' \
  -d '{"name":"Claude test","reason":"consulting","replyVia":"email","replyTo":"dsylvesteriii@gmail.com","message":"test","website":""}'
# expect 202 {"id":"…","delivered":["email","telegram"]}
```

## Paths

- Repo: `D:\projects\davisSylvester\davis-resume` (GitHub `DavisSylvester/resume-website`)
- UI (Angular 21, standalone, signals): `src/ui`
- Activity API (Bun/Elysia on Lambda): `src/api/activity`
- CDK infra: `infrastructure/cdk`
- Sibling repo used this session: `D:\projects\davisSylvester\bjj-open-mat` (app source, marketing
  docs, competitor research in `docs/research/` and `docs/competitors/`, promo video project in
  `scripts/promo-video/`)

## Files changed this session

Activity (PR #6)
- `src/ui/src/app/pages/activity/activity.ts` — `iacTile()` + two IaC tiles in the key figures
- `src/ui/src/app/pages/activity/activity.spec.ts` — new; tests for `iacTile()`

Portfolio (PR #7)
- `src/ui/src/app/portfolio/` — `portfolio-projects.ts` data, `interfaces/` (one interface per
  file), `store-links/` component
- `src/ui/src/app/pages/portfolio/` and `pages/portfolio-project/` — list and summary pages
- `src/ui/src/app/app.routes.ts`, `app.ts` (standalone pages), `app.config.ts`
  (`withComponentInputBinding()`), `components/navbar/navbar.html` (Portfolio link)
- `src/ui/public/images/projects/bjj-open-mat-icon.png`

Professional Projects + responsive (PR #8)
- `src/ui/src/app/sections/projects/*` — new accent section (own `projects.scss`)
- `store-links` — `onAccent` input
- `src/ui/src/styles.scss` — removed old projects styles; Expertise grid 6→3→2→1 breakpoints;
  `.cards` minimum `min(100%, 300px)`
- `sections/expertise/expertise.scss`, `sections/certifications/certifications.scss` — shrink-to-fit
- `src/app/app.spec.ts` — `provideRouter([])`

Responsive pass (PR #9)
- `docs/responsive-plan.md` — the plan, plus a status section listing where the build departs from it
- `src/ui/src/styles/_breakpoints.scss` — new; `bp.up()` / `bp.below()` mixins
- `src/ui/src/styles.scss` — rewritten mobile-first: fluid type and spacing tokens, `--gutter`,
  1440px content cap, reduced-motion guard, focus outlines; dead light theme and navbar rules removed
- `src/ui/angular.json` — `stylePreprocessorOptions.includePaths: ["src/styles"]`
- `components/navbar/*` — brand, menu button, drawer, `links` array, close on Esc/click/NavigationEnd; spec has 7 tests
- `components/footer/footer.html` — `id="contact"`
- `sections/certifications/*` — wrapper flattened; one-row scaling grid (`$cert-count`)
- `sections/hero/hero.scss` — single column with the photo first on phones, row from md; fluid sizes
- `sections/expertise`, `badges`, `projects`, `pages/portfolio-project` SCSS — moved onto the shared breakpoints
- `src/ui/e2e/responsive.spec.ts`, `src/ui/playwright.config.ts` — responsive sweep;
  `@playwright/test` dev dependency; `e2e` script
- `.gitignore` — `ai/screenshots/`, `test-results/`, `playwright-report/`

Contact modal (PR #12)
- `docs/contact-form.md` — new; flow, API contract, per-channel setup, local dev
- `src/ui/src/app/contact/` — new; `contact-options.ts` (reasons, reply channels, `isValidReplyTo`),
  `contact-api.service.ts`, `contact-dialog.service.ts` (open/close signal), `interfaces/`
- `src/ui/src/app/components/contact-dialog/*` — new; native `<dialog>` + reactive form, 8 tests
- `components/navbar/*` — Contact links became buttons that open the modal; 2 new tests
- `src/ui/src/app/app.ts` — renders `<app-contact-dialog>`
- `src/api/activity/src/clients/contact/` — new; one notifier per channel, secrets providers, `cleanSecrets`
- `src/api/activity/src/services/contact/` — new; `DefaultContactService`, `validateReplyTo`, message formatting
- `src/api/activity/src/repositories/*contact-repository.mts` — new; DynamoDB + in-memory
- `src/api/activity/src/routes/activity-router.mts` — `POST`/`OPTIONS /contact`; CORS now allows POST
- `src/api/activity/index.mts` — sets `x-source-ip` from API Gateway; `dev.mts` uses the in-memory contact repo
- `src/api/activity/src/schemas/` (`contact.schema.mts`, `env.schema.mts`), `types/`, `interfaces/i-contact-*`, `errors/contact-error.mts`
- `src/api/activity/test/contact-*.test.mts` (new), `router.test.mts` (4 route tests)
- `infrastructure/cdk/lib/activity-api.ts` — `ContactSecret`, `CONTACT_*` env vars, `/contact` route, outputs

## Commands

```bash
cd src/ui
npx ng test --watch=false     # vitest via @angular/build:unit-test
npx ng build
npx ng serve --port 4300      # dev server (restart after angular.json changes)
bun run e2e                   # responsive sweep; reuses :4200 or starts ng serve
E2E_BASE_URL=http://localhost:4300 bun run e2e      # against another server
E2E_BASE_URL=https://www.dsylvester.io bun run e2e  # against production
# contact: local API with mock or real channels; the UI on :4200 posts to :3100
cd src/api/activity && CONTACT_RATE_LIMIT_PER_HOUR=100 SLACK_WEBHOOK_URL=... bun dev.mts
# set channel credentials (JSON file from your password manager; delete it afterwards)
aws secretsmanager put-secret-value --profile dsylvesteriii --secret-id gh-app-contact-prod --secret-string file://contact-secret.json
gh pr merge <n> --merge         # the user runs this; blocked for Claude in auto mode
gh pr view 8 --json mergeStateStatus,statusCheckRollup
gh run list --branch main --limit 2   # watch the deploy after a merge
```

Visual checks were done with small Playwright scripts (`bun <script>.mjs`) in the session
scratchpad, against `ng serve`; to hit the live API from localhost, route
`http://localhost:3100/**` to the prod API in Playwright.

## Vocabulary

- **Key figures** — the row of KPI tiles at the top of `/activity` (`section.act-tiles`).
- **Insights** — `snapshot.insights` from the activity API (IaC, stack, PRs, CI/CD, career).
- **Sweep / responsive sweep** — `e2e/responsive.spec.ts`: 8 widths × 4 pages plus the cert-row and nav checks.
  Screenshots go to `ai/screenshots/responsive/` (gitignored); pre-change ones are in `ai/screenshots/baseline/`.
- **base / sm / md / lg / xl** — the breakpoints in `_breakpoints.scss` (0 / 600 / 900 / 1200 / 1536).
- **Contact modal / contact dialog** — `<app-contact-dialog>`; opened by the navbar Contact buttons.
- **Reply channel** (`replyVia`) — how the *visitor* wants to be answered: whatsapp, sms, email.
  **Notify channel** — where Davis *receives* the request: email, sms, whatsapp, telegram, slack, teams.
- **Skipped** — a notify channel with no credentials (or `REPLACE_ME`); not a failure.
- **Professional Projects** — the home-page accent band (component still named `Projects`,
  anchor `#projects`).

## Rules and patterns

- Git: GitHub Flow here (`main` + `feature/*`), conventional commits, merge commits for PRs,
  **never** a Co-Authored-By line; commits end with the `Claude-Session:` line.
- Angular: standalone components, separate HTML/SCSS files, signals; explicit types and return
  types; `type` alias (not interface) only where a framework needs an indexable record.
- Responsive CSS is mobile-first: base rules for phones, then `@include bp.up(md)` and so on.
  Use the tokens (`--fs-*`, `--space-*`, `--gutter`) instead of new per-width font-size overrides.
- Health endpoints are `/activity/health` and `/activity/ready` — never `/healthz`.

## Environment

- Bun 1.4.x, Node 26, Angular 21. `gh` authenticated as DavisSylvester.
- Contact channel settings belong in Secrets Manager `gh-app-contact-prod` (account
  318205107378, profile `dsylvesteriii`); locally in env vars (`CONTACT_EMAIL_FROM`,
  `CONTACT_SMS_ORIGINATION_IDENTITY`, `CONTACT_WHATSAPP_*`, `TELEGRAM_BOT_TOKEN`,
  `TELEGRAM_CHAT_ID`, `SLACK_WEBHOOK_URL`, `TEAMS_WEBHOOK_URL`). Email, SMS and WhatsApp use
  AWS (SES / End User Messaging) through the Lambda role, so they need no keys. Email is live
  (`CONTACT_EMAIL_FROM` set in CDK). Of the secret's keys, only Telegram has real values.
- Repo `.env` (gitignored) holds `TELEGRAM_TOKEN` and `TELEGRAM_BOT_NAME=davis_resume_web_bot`.
  Note the API's local env var is `TELEGRAM_BOT_TOKEN`, not `TELEGRAM_TOKEN`.
- Writing Secrets Manager is blocked for Claude in auto mode, so the user runs the
  put-secret-value step (Claude writes a script that merges keys and prints no values).
- The Lambda caches the secret for 15 min; after a secret change, wait that long before retesting.

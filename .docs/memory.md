# Memory — davis-resume

Durable facts and decisions. Last updated 2026-10-18 (contact modal, PR #12).

## Site and deploy

- The live site is **https://www.dsylvester.io** (also `www.dsylvester.ai`). The bare apex
  `dsylvester.io` does **not resolve** (checked 2026-10-15). If a page "isn't updating", first
  confirm the visitor is on `www.`.
- Every push to `main` deploys via `.github/workflows/deploy.yml` (job "Deploy to AWS"; skipped
  on PRs). A deploy takes ~1.5 min. `index.html` is served `no-cache`, so a hard refresh picks
  up a new build.
- Activity API: `https://etgzi1pkz8.execute-api.us-east-1.amazonaws.com/activity/snapshot`
  (`ACTIVITY_API_PROD_URL` in `src/ui/src/app/activity/activity.config.ts`). On localhost the UI
  calls `http://localhost:3100` and silently falls back to `public/data/activity-sample.json`.

## Decisions

- **Activity key figures include IaC tiles** (`AWS CDK commits`, `Terraform commits`), built by
  `iacTile()` in `pages/activity/activity.ts` from `snapshot.insights.iac.tools`. A tool with no
  stats renders "–" rather than disappearing, so the row length is stable.
- **Portfolio is data-driven.** `src/ui/src/app/portfolio/portfolio-projects.ts`
  (`PORTFOLIO_PROJECTS`) feeds `/portfolio`, `/portfolio/:slug` and the home page's
  **Professional Projects** section. Adding a project = one entry + an icon in
  `public/images/projects/`.
- **The home "Selected Projects" section was replaced (2026-10-18, PR #8)** by an accent-colored
  "Professional Projects" band of shipped products. The old employer cards duplicated the
  Experience section; the "Get In Touch" button only `console.log`ged.
- **Mobile-first breakpoints are shared (2026-10-18, PR #9).** `src/ui/src/styles/_breakpoints.scss`
  defines sm 600 / md 900 / lg 1200 / xl 1536 with `bp.up()` / `bp.below()`. Components import it
  as `@use 'breakpoints' as bp;` via `stylePreprocessorOptions.includePaths` in `angular.json`.
  New responsive rules use these; do not add raw `max-width` queries. The rationale and the
  departures from the plan are in `docs/responsive-plan.md`.
- **Certifications are always one row.** It's a `repeat($cert-count, minmax(0,1fr))` grid whose
  cells scale (about 42px at 320px). Adding a cert means bumping `$cert-count` in
  `certifications.scss`; the e2e sweep asserts one row at 8 widths.
- **Dark purple is the only theme.** The "light theme" in `styles.scss` was a `:root` nested
  in `:root` and never applied; it was deleted, not wired to `prefers-color-scheme`.
- **Navbar below 900px is a menu button and drawer.** It closes on Esc, link click and router
  `NavigationEnd`. That last one is a manual `Router.events` subscription torn down with
  `DestroyRef`; `rxjs-interop` was avoided because of the NG0203 trap below. The full inline bar
  fits from 900px with a 1.25rem gap, so the planned "Sections" dropdown was not built.
- **Contact = a modal (PR #12, 2026-10-18), no longer the footer.** Both navbar Contact
  buttons call `ContactDialogService.open()`; `<app-contact-dialog>` lives once in `app.ts`.
  The footer keeps `id="contact"` but nothing links to it now. Section links are rooted at `/`.
- **Contact delivery fans out to six channels in parallel**: email (Resend), SMS and WhatsApp
  (one Twilio account), Telegram (bot), Slack (incoming webhook), Teams (Workflows webhook,
  Adaptive Card). The request succeeds if any one channel sends. Providers were picked by
  Claude, not the user: Resend because the user already uses it (yt-sub-digest), Twilio
  because one account covers both SMS and WhatsApp. The user added Slack and Teams mid-task.
- **Contact lives inside the activity API Lambda**, not a new service: `POST /contact` on the
  same HTTP API and the same `gh-app-activity-api-prod` function, sharing its DynamoDB table
  (`pk=CONTACT` audit copy kept 365 days, `pk=CONTACT_RATE` hourly counters). Chosen to reuse
  the DI container, Bun runtime and deploy pipeline instead of a second Docker image.
- **Channel credentials are in Secrets Manager `gh-app-contact-prod`** (RETAIN, CDK-created with
  every value `REPLACE_ME`). `cleanSecrets()` treats blank or `REPLACE_ME` as unset, so that
  channel is *skipped*, not failed. All six skipped → 503 "Messaging is not set up yet".
  Recipients are env vars in `infrastructure/cdk/lib/activity-api.ts`:
  `CONTACT_EMAIL_TO=dsylvesteriii@gmail.com`, `CONTACT_PHONE_TO=+12142231413`. The user typed
  "dsylvester" (cut off) for the email; the site's existing address was assumed.
- **Rate limit fails open.** 5 requests/hour per source IP; if DynamoDB errors, the request
  still goes through. The honeypot field `website` returns a normal 202 and sends nothing.
- **Source IP comes only from API Gateway.** `index.mts` deletes any client-sent `x-source-ip`
  and sets it from `requestContext.http.sourceIp`; locally every request is `local`.
- **BJJ Open Mat's GitHub repo is private**, so portfolio entries carry store + website links but
  no repo link.

## Traps

- **`toSignal()` from `@angular/core/rxjs-interop` throws NG0203 on the Vite dev server only**
  (prebundled duplicate `@angular/core`). Unit tests and `ng build` do not catch it. The fix used:
  `withComponentInputBinding()` in `app.config.ts` and read route params as signal `input()`s.
- **Any component using `RouterLink` that the home page renders makes `app.spec.ts` need
  `provideRouter([])`** — otherwise NG0201 "No provider found for ActivatedRoute".
- **A running `ng serve` does not pick up `angular.json` changes**, such as `includePaths`. It
  fails with "Can't find stylesheet to import" until restarted. Stopping the background shell
  can leave the child `node` process holding the port; check `Get-NetTCPConnection -LocalPort`.
- **`[value]` on a radio with `formControlName` is the `RadioControlValueAccessor` input, not
  the DOM property** — the rendered radios have `value="on"`. The contact dialog binds
  `[attr.value]` too so tests and e2e can select by value, and sets a native `name` on each group.
- **Screenshots right after clicking a contact option show stale highlight colors.** The
  option cards fade over 150 ms; a screenshot inside that window looks like the wrong option
  is selected. Wait ~400 ms before judging. (Adding native `name`s was still worth keeping.)
- **Local contact testing trips the rate limit after 5 sends** because every local request
  shares the IP `local`. Start `dev.mts` with `CONTACT_RATE_LIMIT_PER_HOUR=100`.
- **`gh pr merge` is blocked by the auto-mode permission classifier** (it deploys to prod).
  The user merges with `! gh pr merge <n> --merge` or on GitHub.
- **The UI project has no ESLint configured** (`ng lint` prompts to add angular-eslint).
- **"Pull requests" tile shows "0 reviews"** — the API returns `totals.reviews = 0`; not
  investigated, likely not populated by the snapshot builder.

## Verified state (2026-10-18)

- `ng test`: 30/30 pass on `main` after PR #9; `ng build` clean.
- `bun run e2e` (Playwright, `src/ui/e2e/responsive.spec.ts`): 48/48 pass against the dev
  server **and against https://www.dsylvester.io**. It covers widths 320 to 1920 × `/`, `/about`,
  `/portfolio` and `/activity`: no sideways scroll, certs on one row, drawer below 900px.
- PRs #6, #7, #8 and #9 merged and deployed ("Deploy to AWS" succeeded for #9).
- Activity charts at 320px: the radial calendar (246px) and heatmap (280px) fit their 288px
  cards, so no in-card scroll is needed.

## Verified state (2026-10-18, contact modal)

- PR #12 merged as `bf7fb94`; "Deploy to AWS" succeeded.
- Activity API `bun test` 127/127, `tsc --noEmit` and `eslint .` clean. UI `ng test` 46/46,
  `ng build` OK with one warning (contact-dialog.scss 4.9 kB > 4 kB budget). e2e sweep 48/48.
- Live probes: `OPTIONS /contact` 204 with `allow-methods: GET, POST, OPTIONS` for
  `https://www.dsylvester.io`; an invalid POST returns 400 `{"code":"invalid",...}`; the secret
  exists with tag `application=resume-website`.
- Full browser flow (desktop 1280, phone 390) passed against `dev.mts` with mock Slack/Teams
  webhooks. **Real delivery on any channel is unverified** — no credentials exist yet.

## Contact channels — Telegram (2026-10-18)

- **Decision: the contact form uses its own bot, @davis_resume_web_bot**, not the user's
  @YtDailySubBot (yt-sub-digest). Reusing that bot worked but mixed contact requests into the
  YouTube digest chat; the user created the dedicated bot. Its token is `TELEGRAM_TOKEN` in the
  gitignored repo `.env`; the chat id is the user's private chat with the bot (from `getUpdates`).
- **Trap: a secret change takes up to 15 minutes to show up.** The Lambda caches
  `gh-app-contact-prod` for 15 min per warm container (`CACHE_MS` in
  `secrets-manager-contact-secrets-provider.mts`). A request right after `put-secret-value` still
  sees old values — 503 `not_configured` (or the old bot) with `delivered: []` in the logs. Find the
  last load time in the logs (`contact request processed`) and test 15 min after it.
- **Trap: test requests count toward the 5/hour per-IP limit and send real messages.** Don't poll.
- **Trap: a new Telegram bot can't message anyone until they send it `/start`** — `getUpdates`
  returns no chat until then.
- **Trap: `date -d 'HH:MM:SS'` in Git Bash is local time (CDT), not UTC** — a "sleep until"
  computed that way waited 5 hours. Use a full ISO timestamp with `Z`.
- **Trap: `aws logs tail /aws/lambda/...` in Git Bash fails** (MSYS path conversion mangles the
  log group); prefix `MSYS_NO_PATHCONV=1`.
- Secrets Manager writes are denied to Claude by the auto-mode classifier; the user runs them.

## Related work outside this repo

- BJJ Open Mat promo videos (15 s + 60 s) live in the **separate** repo
  `D:\projects\davisSylvester\bjj-open-mat\scripts\promo-video` (Remotion). Not committed there.
  Music: "Street Hip-Hop" by SoundSurfer (Pixabay Content License), 96 BPM. A commercially
  released song ("Can't Be Touched") was requested and declined — it needs a sync license.

# Session log

## 2026-10-15 → 2026-10-18

**CDK / Terraform KPIs on /activity.** The user reported no CDK/Terraform KPIs. The API and the
live page both had them inside the "Infrastructure as code" card; the ask was for them in the
top key-figures row. Added `iacTile()` tiles (PR #6, merged, deployed). The deploy-watch
command was blocked by the permission classifier, so deploy completion was confirmed later by
the run list rather than watched.

**Public projects portfolio.** Built `/portfolio` and `/portfolio/:slug` from a data file, with
BJJ Open Mat as the first entry (copy sourced from the bjj-open-mat README, marketing docs and
code; both store links verified 200). Playwright caught an NG0203 crash from `toSignal()` on
the dev server that unit tests missed; replaced with router input binding. Fixed low-contrast
card headings (`--accent` on dark cards). PR #7 merged and confirmed live.

**BJJ Open Mat promo videos (in the bjj-open-mat repo, not this one).** Built a Remotion
project at `bjj-open-mat/scripts/promo-video`: 15 s and 60 s vertical cuts with recreated app
and admin-portal UI, Pexels b-roll, synthesized effects, and a competitor-comparison scene
sourced from `docs/research/competitive-analysis.md` plus a 2026-10 check of House of
Grapplers (which has a gym directory and per-gym boards, so those were not claimed as unique).
Existing repo screen recordings were unusable (empty states, emulator home screens). Declined to
use "Can't Be Touched" (copyrighted, needs a sync license); shortlisted free Pixabay tracks, the
user picked "Street Hip-Hop" (96 BPM) and both cuts were re-timed in beats to it. Outputs in
`bjj-open-mat/ai/video-results/`. Nothing committed in that repo.

**Professional Projects + responsive fix.** Replaced the home page's Selected Projects with an
accent-colored Professional Projects band driven by the portfolio data (PR #8). While checking
phone width, found the Expertise grid fixed at 6 columns overflowing every viewport under
~1280 px (201 px at 1024); added 3/2/1 breakpoints and shrink-to-fit minimums so nothing
overflows down to 320 px. Committed as two commits (feat + fix) by splitting `styles.scss`
hunks. PR #8 open, checks passing.

**Left unfinished:** PR #8 merge (awaiting user); three missing Expertise logo files; "0 reviews"
on the PR tile; no ESLint in the UI; promo-video project uncommitted in bjj-open-mat; the
plaintext GCP key file outside both repos.

## 2026-10-18 (later): responsive pass

**Plan.** Audited the UI's responsive behavior. Breakpoints differed in every file and were all
desktop-first. The light theme was dead code (`:root` nested in `:root`). The navbar wrapped on
phones, the hero tagline shrank to 0.65rem, and the certification row wrapped between about 900
and 1,560px because of a fixed `flex: 0 0 240px`. Wrote `docs/responsive-plan.md` and a
Claude Design prompt for a mobile-first redesign with motion (given in chat, not saved to a file).

**Implementation (PR #9).** Wrote the Playwright sweep first and ran it as a baseline: 7 of 48
failed (certs at 1024/1280/1440, no drawer at 320 to 768). Then built the shared breakpoints,
rewrote `styles.scss`, and reworked the certs grid, navbar drawer, hero, expertise, experience
and badges. Result: 48/48. Phone home page height went from 10,410 to 8,218px.

**Failures along the way.** The `@use 'breakpoints'` import failed on the already-running
`ng serve` because `angular.json` changes need a restart. Stopping the background task left
the `node` child holding port 4300, so it was killed by PID. Also found that the Contact button
never had a target (`#contact` did not exist); the footer now has that id.

**Follow-up pass.** Added drawer close on router `NavigationEnd` (manual subscription, avoiding
rxjs-interop), explicit 1/2/3 Experience columns, and measured the Activity charts at 320px
(they fit, so no change).

**Shipped.** Committed `68e30ac`, opened PR #9; CI "Test and build" passed, then merged as
`c562e46`. "Deploy to AWS" succeeded, and the sweep passed 48/48 against www.dsylvester.io.
git-sync pruned three dead remote-tracking refs and kept `feature/responsive-layout`, which
awaits the user's OK to delete it remotely.

**Left unfinished:** delete the merged branch; e2e not in CI; Claude Design redesign not
started; carried forward from earlier: missing Expertise logos, "0 reviews" tile, no UI ESLint,
bjj-open-mat promo uncommitted, plaintext GCP key file.

## 2026-10-18 (evening): contact modal (PR #12)

**Ask.** Make the Contact button open a modal where a visitor requests consulting services,
a resume or employment, and chooses to be answered by WhatsApp (giving their WhatsApp id),
SMS (phone number) or email; deliver the request to Davis on all channels plus Telegram.
Mid-task the user added Slack and Teams.

**Built.** Backend inside the existing activity API: `POST /contact` → `DefaultContactService`
(honeypot, channel-aware reply-to validation, 5/hour per-IP limit in DynamoDB, audit copy,
parallel fan-out to six notifiers). CDK adds the `gh-app-contact-prod` secret with
`REPLACE_ME` placeholders, env vars and the route. Frontend: a native `<dialog>` with a
reactive form, a shared open/close signal service, and navbar buttons wired to it.
`docs/contact-form.md` covers setup.

**Failures along the way.**
- Long bash heredocs holding several files broke on quoting and created only some of them;
  wrote files with the Write tool (or a script file) instead.
- `scripts/collect-local.mts` builds an `AppConfig` literal and failed type-check until it got
  a `contact` block.
- Unit tests could not select radios by value: `[value]` with `formControlName` goes to the
  Angular accessor, so the DOM value is `on`. Added `[attr.value]`.
- Browser screenshots showed two options highlighted per group. Added native `name`s, but the
  real cause was the 150 ms fade; after a 400 ms wait the computed styles were correct.
- The phone half of the browser check timed out: the 6th local send hit the 5/hour limit
  (all local requests share IP `local`). Restarted `dev.mts` with a higher limit.
- The `ng serve` child node kept port 4300 after the task was stopped; killed by PID.
- `gh pr merge` was denied by the auto-mode classifier; the user merged with `!`.

**Shipped.** Commit `9ddeae7`, PR #12, CI and GitGuardian passed, merged as `bf7fb94`,
"Deploy to AWS" succeeded. Live checks: preflight 204, invalid POST 400, secret present and
tagged. No real message was sent.

**Left unfinished:** every channel's credentials (user); a real delivery test; Resend domain and
Twilio registrations; confirm the contact email; dialog SCSS budget warning; delete the merged
branch. Carried forward: missing Expertise logos, "0 reviews" tile, no UI ESLint, e2e not in CI,
Claude Design redesign, bjj-open-mat items.

## 2026-10-18 (night): Telegram channel goes live

**Ask.** Finish Telegram first, then switch it to a dedicated bot, @davis_resume_web_bot.

**Done.**
- Put @YtDailySubBot's token and chat id (from `yt-sub-digest/.env`) into `gh-app-contact-prod`
  with a merge-keys script the user ran (Claude's own `put-secret-value` was denied by auto mode).
  A live `POST /contact` at 07:22 UTC returned 202 `delivered: ["telegram"]`; the user received it.
- The user asked for its own bot. The token was in the repo `.env` (`TELEGRAM_TOKEN`,
  `TELEGRAM_BOT_NAME`). `getMe` confirmed the username; `getUpdates` had no chat until the user
  sent `/start`. The user ran the updated script (saved 07:29:33 and again 07:29:59 UTC, same values).
  A direct `sendMessage` from the new bot reached the user's chat (confirmed).

**Failures along the way.**
- First live test returned 503 `not_configured`: the Lambda's 15-min secret cache still held the
  `REPLACE_ME` values. Logs showed `delivered: []` for requests at 06:51 and 07:00 UTC.
- A "sleep until 07:06:40" used `date -d` without a zone, which Git Bash read as local CDT time, so
  the retest would have fired ~5 hours late. Killed it and sent the request directly.
- `aws logs tail` failed until run with `MSYS_NO_PATHCONV=1`.

**Left unfinished:** confirming a live form submission arrives from @davis_resume_web_bot — the
07:37:30 UTC live test returned 202 `delivered: ["telegram"]`, sender not yet confirmed by the user; the other five channels' credentials;
everything carried forward in todo.md.

# Todo

## Security hardening (2026-11-14, feature/aws-hardening)

- [ ] Unsuspend the GitHub App installation — suspended since 2026-11-13 8:46 AM CST (cause unknown; check https://github.com/settings/security-log first). https://github.com/settings/installations/171901652 → Danger zone → Unsuspend; needs the user's sudo
- [ ] Re-add Pull requests + Actions read to the App, and accept the new permissions on the installation — user reversed the read-only cut on 2026-11-14; needs their sudo
- [ ] Re-verify the App after both changes — `GET /app` and `GET /app/installations/171901652` with an App JWT should show only contents+metadata read and `suspended_at: null`
- [ ] Delete the root access key — active, never used; only the root sign-in can delete it (Security credentials)
- [X] Add MFA to IAM user `dsylvester` — virtual device `dsylvester-phone` enabled 2026-11-15 10:26 PM CST; `list-mfa-devices` shows it, CLI still works
- [X] Delete unassigned virtual MFA device `jjames` — confirmed unassigned and never enabled, then deleted 2026-11-15; only the root and `dsylvester-phone` devices remain
- [ ] Merge the feature/aws-hardening PR — deploys CloudTrail `gh-app-cloudtrail-prod` + bucket `gh-app-cloudtrail-logs-prod`; then confirm with `aws cloudtrail get-trail-status --name gh-app-cloudtrail-prod`
- [X] Protect `main` on resume-website — ruleset `protect-main` id 27278574 active (PR + 1 approval, no force-push/delete, repo-admin bypass); confirmed via the create response
- [X] Delete unused `dsylvester` access key `...FYX7` — never used per get-access-key-last-used; `list-access-keys` now shows only `...R3BA`
- [X] App manifest and docs list contents, metadata, pull_requests and actions read — matches the user's revised decision
- [X] Audit who read `gh-app-github-app-prod` — CloudTrail 90-day history: only the activity Lambda role and `dsylvester` (Claude's own checks)

## Contact modal (PR #12)

- [X] Fill `gh-app-contact-prod` for at least one channel — Telegram set 2026-10-18 07:29:59 UTC with @davis_resume_web_bot (token from repo `.env`)
- [X] Send one real test message through the live form — 2026-10-18 07:22 UTC via the earlier @YtDailySubBot config: 202, `delivered: ["telegram"]`, user received it
- [X] Give the contact form its own Telegram bot — @davis_resume_web_bot; direct `sendMessage` from it reached the user's chat (user confirmed 2026-10-18)
- [X] Live form submission arrives from @davis_resume_web_bot — 07:37:30 UTC 2026-10-18 test returned 202 `delivered: ["telegram"]` (id a5b50a39); user confirmed the sender
- [X] Email via Amazon SES instead of Resend — sender `contact@dsylvester.ai` (already-verified SES identity, DKIM on, account has production access); local SES send returned `sent` 2026-10-18
- [X] PR #14 merged (`a7884e5`, admin) and deployed; live `POST /contact` 2026-10-18 returned 202 `delivered: ["email","telegram"]` (id 48e88995)
- [X] Live SES email reached Gmail — found 2026-10-18 via Gmail search: 13:08 and 13:20 UTC messages from `contact@dsylvester.ai` are in INBOX under the **Updates** tab (not spam), so the user missed them
- [ ] Gmail filter so contact emails land in Primary — `from:contact@dsylvester.ai` → Categorize as Primary, Never send to Spam, Star; the user creates it (no filter tool)
- [ ] Add a DMARC record for `dsylvester.ai` — none exists (`_dmarc` NXDOMAIN); not needed today since mail reaches the inbox, but it protects the domain from spoofing
- [X] Replace Twilio with AWS End User Messaging (SMS + WhatsApp, IAM role, no keys) — feature/aws-messaging-and-cleanup; API 130/130, cdk synth shows both grants
- [ ] AWS SMS: request a toll-free number in us-east-1 (End User Messaging SMS), finish its registration, add `smsOriginationIdentity` to `gh-app-contact-prod` — blocked on the user and carrier review
- [ ] AWS WhatsApp: link a WhatsApp Business Account + sender number in End User Messaging Social, create a Utility template (`contact_request`, 2 body params), add `whatsAppPhoneNumberId` + `whatsAppTemplateName` to the secret — blocked on the user and Meta review
- [X] Contact email recipient is `dsylvesteriii@gmail.com` — user found the SES test email there 2026-10-18 and kept that address
- [X] `contact-dialog.scss` under the 4 kB budget — form primitives moved to global `src/styles/_forms.scss`; build has no warnings, dialog checked at 390/1280 px
- [X] Delete merged branches `feature/contact-modal`, `aws-messaging-and-cleanup`, `legal-pages`, `sms-opt-out-line` — deleted locally and on GitHub 2026-10-18 after the user's OK; `git branch -a` shows only `main`
- [X] Contact modal + `POST /contact` with six channels — PR #12 merged as `bf7fb94`, deploy succeeded; API 127/127, UI 46/46, e2e 48/48; live preflight 204 and invalid POST 400 checked 2026-10-18
- [X] Slack and Teams channels added — mock-webhook browser run delivered to both

## davis-resume

- [ ] Fix broken Expertise logos — `visualstudio.svg`, `vscode.svg`, `playwright.svg` are missing from `src/ui/public/images` (404); needs logo files from the user, or swap those tiles to text
- [X] "0 reviews" on the Activity Pull requests tile — not a bug: GitHub's `totalPullRequestReviewContributions` is 0 even with the user's token because the ~120 reviews are in private DavacoLP repos (restricted). UI now hides a zero count (`pullRequestNote`, insights tile)
- [ ] Optional: count org reviews via a user token + search `reviewed-by:DavisSylvester -author:DavisSylvester` (120 on 2026-10-18) — needs a PAT in Secrets Manager; user hasn't asked
- [X] ESLint (angular-eslint 21.4, eslint 10) in `src/ui` — `bun run lint` clean; App moved to `inject()` + `@if`
- [X] CI runs UI lint, unit tests, build and the e2e sweep (artifact upload on failure) — green on PR #14 and the main deploy
- [ ] Hand the Claude Design redesign prompt to Claude Design — prompt was given in chat 2026-10-18 (mobile-first redesign with motion); it would replace the navbar/hero work but build on the tokens and e2e sweep
- [X] Delete the merged `feature/responsive-layout` branch — deleted locally and on GitHub 2026-10-18 after the user's OK; `git branch -r` shows only `origin/main`
- [X] Responsive site (mobile/tablet/desktop) per `docs/responsive-plan.md` — PR #9 merged + deployed; e2e 48/48 against live www.dsylvester.io; ng test 30/30
- [X] All certification badges on a single row — e2e asserts one row at 320–1920 px, passing live
- [X] Merge PR #8 (Professional Projects + responsive fix) — merged as a71aa87
- [X] CDK + Terraform tiles in the Activity key figures — PR #6 merged; 3 unit tests pass; seen live
- [X] `/portfolio` list + `/portfolio/bjj-open-mat` summary page — PR #7 merged; Playwright confirmed live page renders with title "BJJ Open Mat | Davis Sylvester"
- [X] Professional Projects accent section replaces Selected Projects — 24/24 tests, build passes, checked dark/light/390px (PR #8)
- [X] Home page horizontal overflow on tablets/phones — zero overflow 320–1920 px in the e2e sweep (PR #8, PR #9)
- [X] Claude Dashboard portfolio entry with a Secure badge — branch `feature/claude-dashboard-project` (2026-11-26); ng test 53/53, eslint clean, ng build passes; screenshots of home band and `/portfolio/claude-dashboard` checked
- [X] Private projects page `/private-projects` — user asked 2026-11-26; `/portfolio` now lists public only with a link to it; home lead reworded; ng test 59/59, eslint clean, e2e 72/72 on :4322, screenshots at 1280 and 390 px
- [X] Reword "public"/"App Store" copy — home lead now says some are in the stores and others run privately; "Public projects" stays correct because `/portfolio` lists public projects only
- [X] Run the e2e responsive sweep against the new card — 72/72 against `ng serve --port 4322` (2026-11-26)
- [X] PR #21 merged and live — merge `5965b32` 2026-11-26 12:33 PM CST; Deploy run 45876818090 succeeded; Playwright on www.dsylvester.io: `/private-projects` title right, no `#hero`, Secure badge shown; `/portfolio` has no secure cards
- [ ] Navbar link to `/private-projects` — not added: the inline bar only just fits at 900 px; reachable from `/portfolio` and the home band
- [ ] More private projects — only Claude Dashboard is listed; user to name others (each needs `secure: true` + an icon)

## Outside this repo

- [ ] Commit `bjj-open-mat/scripts/promo-video` in the bjj-open-mat repo — user hasn't asked; untracked along with other files in `ai/video-results/`
- [ ] Move / rotate the plaintext GCP service-account key at `D:\projects\davisSylvester\bjj-open-mat.json` — contains a private key, sits outside both repos; user was told 2026-10-17
- [ ] Swap the drawn store badges in the promo end card for official App Store / Google Play badge artwork before running as paid ads

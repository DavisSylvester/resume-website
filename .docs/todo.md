# Todo

## Contact modal (PR #12)

- [X] Fill `gh-app-contact-prod` for at least one channel — Telegram set 2026-10-18 07:29:59 UTC with @davis_resume_web_bot (token from repo `.env`)
- [X] Send one real test message through the live form — 2026-10-18 07:22 UTC via the earlier @YtDailySubBot config: 202, `delivered: ["telegram"]`, user received it
- [X] Give the contact form its own Telegram bot — @davis_resume_web_bot; direct `sendMessage` from it reached the user's chat (user confirmed 2026-10-18)
- [ ] Confirm the 07:37:30 UTC live test came from @davis_resume_web_bot — API returned 202 `delivered: ["telegram"]` (id a5b50a39) after the old cache expired; the user still has to confirm which bot sent it
- [ ] Verify a sending domain in Resend and set `resendApiKey` + `emailFrom` — needed for email delivery
- [ ] Twilio: buy a number and complete A2P 10DLC or toll-free verification for SMS; get an approved WhatsApp sender (sandbox only for testing) — blocked on the user and on Twilio/carrier review
- [ ] Confirm the contact email recipient — user typed "dsylvester" (cut off); `CONTACT_EMAIL_TO` is `dsylvesteriii@gmail.com` in `infrastructure/cdk/lib/activity-api.ts`
- [ ] Trim `contact-dialog.scss` under the 4 kB component-style budget, or raise the budget — `ng build` warns at 4.9 kB
- [ ] Delete the merged `feature/contact-modal` branch locally and on GitHub — needs the user's OK
- [X] Contact modal + `POST /contact` with six channels — PR #12 merged as `bf7fb94`, deploy succeeded; API 127/127, UI 46/46, e2e 48/48; live preflight 204 and invalid POST 400 checked 2026-10-18
- [X] Slack and Teams channels added — mock-webhook browser run delivered to both

## davis-resume

- [ ] Fix broken Expertise logos — `visualstudio.svg`, `vscode.svg`, `playwright.svg` are missing from `src/ui/public/images` (404); needs logo files from the user, or swap those tiles to text
- [ ] Investigate "0 reviews" on the Activity Pull requests tile — API `totals.reviews` is 0; check the snapshot builder in `src/api/activity`
- [ ] Add ESLint (angular-eslint) to `src/ui` — global standard is lint after every change; the UI has no linter
- [ ] Run `bun run e2e` in CI — the responsive sweep exists but `.github/workflows/deploy.yml` only runs `bun run build`; needs `npx playwright install chromium` and a server step
- [ ] Hand the Claude Design redesign prompt to Claude Design — prompt was given in chat 2026-10-18 (mobile-first redesign with motion); it would replace the navbar/hero work but build on the tokens and e2e sweep
- [X] Delete the merged `feature/responsive-layout` branch — deleted locally and on GitHub 2026-10-18 after the user's OK; `git branch -r` shows only `origin/main`
- [X] Responsive site (mobile/tablet/desktop) per `docs/responsive-plan.md` — PR #9 merged + deployed; e2e 48/48 against live www.dsylvester.io; ng test 30/30
- [X] All certification badges on a single row — e2e asserts one row at 320–1920 px, passing live
- [X] Merge PR #8 (Professional Projects + responsive fix) — merged as a71aa87
- [X] CDK + Terraform tiles in the Activity key figures — PR #6 merged; 3 unit tests pass; seen live
- [X] `/portfolio` list + `/portfolio/bjj-open-mat` summary page — PR #7 merged; Playwright confirmed live page renders with title "BJJ Open Mat | Davis Sylvester"
- [X] Professional Projects accent section replaces Selected Projects — 24/24 tests, build passes, checked dark/light/390px (PR #8)
- [X] Home page horizontal overflow on tablets/phones — zero overflow 320–1920 px in the e2e sweep (PR #8, PR #9)

## Outside this repo

- [ ] Commit `bjj-open-mat/scripts/promo-video` in the bjj-open-mat repo — user hasn't asked; untracked along with other files in `ai/video-results/`
- [ ] Move / rotate the plaintext GCP service-account key at `D:\projects\davisSylvester\bjj-open-mat.json` — contains a private key, sits outside both repos; user was told 2026-10-17
- [ ] Swap the drawn store badges in the promo end card for official App Store / Google Play badge artwork before running as paid ads

# Todo

## davis-resume

- [ ] Delete the merged `feature/responsive-layout` branch (local + GitHub) — fully merged (`rev-list main..` = 0); kept because git-sync won't delete a remote branch without the user's explicit OK
- [ ] Fix broken Expertise logos — `visualstudio.svg`, `vscode.svg`, `playwright.svg` are missing from `src/ui/public/images` (404); needs logo files from the user, or swap those tiles to text
- [ ] Investigate "0 reviews" on the Activity Pull requests tile — API `totals.reviews` is 0; check the snapshot builder in `src/api/activity`
- [ ] Add ESLint (angular-eslint) to `src/ui` — global standard is lint after every change; the UI has no linter
- [ ] Run `bun run e2e` in CI — the responsive sweep exists but `.github/workflows/deploy.yml` only runs `bun run build`; needs `npx playwright install chromium` and a server step
- [ ] Hand the Claude Design redesign prompt to Claude Design — prompt was given in chat 2026-10-18 (mobile-first redesign with motion); it would replace the navbar/hero work but build on the tokens and e2e sweep
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

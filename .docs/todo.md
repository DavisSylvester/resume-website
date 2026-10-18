# Todo

## davis-resume

- [ ] Merge PR #8 (Professional Projects + responsive fix) — waiting on the user's go-ahead; checks passed
- [ ] Fix broken Expertise logos — `visualstudio.svg`, `vscode.svg`, `playwright.svg` are missing from `src/ui/public/images` (404); needs logo files from the user, or swap those tiles to text
- [ ] Investigate "0 reviews" on the Activity Pull requests tile — API `totals.reviews` is 0; check the snapshot builder in `src/api/activity`
- [ ] Add ESLint (angular-eslint) to `src/ui` — global standard is lint after every change; the UI has no linter
- [X] CDK + Terraform tiles in the Activity key figures — PR #6 merged; 3 unit tests pass; seen live
- [X] `/portfolio` list + `/portfolio/bjj-open-mat` summary page — PR #7 merged; Playwright confirmed live page renders with title "BJJ Open Mat | Davis Sylvester"
- [X] Professional Projects accent section replaces Selected Projects — 24/24 tests, build passes, checked dark/light/390px (PR #8)
- [X] Home page horizontal overflow on tablets/phones — zero overflow 320–1440 px in Playwright (PR #8)

## Outside this repo

- [ ] Commit `bjj-open-mat/scripts/promo-video` in the bjj-open-mat repo — user hasn't asked; untracked along with other files in `ai/video-results/`
- [ ] Move / rotate the plaintext GCP service-account key at `D:\projects\davisSylvester\bjj-open-mat.json` — contains a private key, sits outside both repos; user was told 2026-10-17
- [ ] Swap the drawn store badges in the promo end card for official App Store / Google Play badge artwork before running as paid ads

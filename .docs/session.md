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

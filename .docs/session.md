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

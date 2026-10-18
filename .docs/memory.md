# Memory — davis-resume

Durable facts and decisions. Last updated 2026-10-18.

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
- **BJJ Open Mat's GitHub repo is private**, so portfolio entries carry store + website links but
  no repo link.

## Traps

- **`toSignal()` from `@angular/core/rxjs-interop` throws NG0203 on the Vite dev server only**
  (prebundled duplicate `@angular/core`). Unit tests and `ng build` do not catch it. The fix used:
  `withComponentInputBinding()` in `app.config.ts` and read route params as signal `input()`s.
- **Any component using `RouterLink` that the home page renders makes `app.spec.ts` need
  `provideRouter([])`** — otherwise NG0201 "No provider found for ActivatedRoute".
- **The UI project has no ESLint configured** (`ng lint` prompts to add angular-eslint).
- **"Pull requests" tile shows "0 reviews"** — the API returns `totals.reviews = 0`; not
  investigated, likely not populated by the snapshot builder.

## Verified state (2026-10-18)

- `ng test`: 24/24 pass; `ng build` passes (on `feature/professional-projects`).
- No horizontal overflow on the home page at 1440/1280/1024/768/600/390/320 px (Playwright).
- PR #6 and #7 merged and deployed; `/portfolio/bjj-open-mat` confirmed live in a browser.

## Related work outside this repo

- BJJ Open Mat promo videos (15 s + 60 s) live in the **separate** repo
  `D:\projects\davisSylvester\bjj-open-mat\scripts\promo-video` (Remotion). Not committed there.
  Music: "Street Hip-Hop" by SoundSurfer (Pixabay Content License), 96 BPM. A commercially
  released song ("Can't Be Touched") was requested and declined — it needs a sync license.

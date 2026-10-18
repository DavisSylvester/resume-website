# Memory — davis-resume

Durable facts and decisions. Last updated 2026-10-18 (responsive pass, PR #9).

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
- **Contact = the footer.** The navbar's Contact goes to `/#contact`, which is the footer
  (`id="contact"`). Before 2026-10-18 the anchor did not exist. Section links are rooted at `/`.
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

## Related work outside this repo

- BJJ Open Mat promo videos (15 s + 60 s) live in the **separate** repo
  `D:\projects\davisSylvester\bjj-open-mat\scripts\promo-video` (Remotion). Not committed there.
  Music: "Street Hip-Hop" by SoundSurfer (Pixabay Content License), 96 BPM. A commercially
  released song ("Can't Be Touched") was requested and declined — it needs a sync license.

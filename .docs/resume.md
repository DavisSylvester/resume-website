# Resume

## Where to pick up

All PRs (#6 to #10) are merged and deployed, and the merged feature branches are deleted.
Next, pick from `.docs/todo.md`. The quickest wins are the
three missing Expertise logos and wiring `bun run e2e` into CI. If the user brings back a
Claude Design redesign, build it on `_breakpoints.scss` and the fluid tokens in `styles.scss`,
and keep the e2e sweep green.

## Paths

- Repo: `D:\projects\davisSylvester\davis-resume` (GitHub `DavisSylvester/resume-website`)
- UI (Angular 21, standalone, signals): `src/ui`
- Activity API (Bun/Elysia on Lambda): `src/api/activity`
- CDK infra: `infrastructure/cdk`
- Sibling repo used this session: `D:\projects\davisSylvester\bjj-open-mat` (app source, marketing
  docs, competitor research in `docs/research/` and `docs/competitors/`, promo video project in
  `scripts/promo-video/`)

## Files changed this session

Activity (PR #6)
- `src/ui/src/app/pages/activity/activity.ts` — `iacTile()` + two IaC tiles in the key figures
- `src/ui/src/app/pages/activity/activity.spec.ts` — new; tests for `iacTile()`

Portfolio (PR #7)
- `src/ui/src/app/portfolio/` — `portfolio-projects.ts` data, `interfaces/` (one interface per
  file), `store-links/` component
- `src/ui/src/app/pages/portfolio/` and `pages/portfolio-project/` — list and summary pages
- `src/ui/src/app/app.routes.ts`, `app.ts` (standalone pages), `app.config.ts`
  (`withComponentInputBinding()`), `components/navbar/navbar.html` (Portfolio link)
- `src/ui/public/images/projects/bjj-open-mat-icon.png`

Professional Projects + responsive (PR #8)
- `src/ui/src/app/sections/projects/*` — new accent section (own `projects.scss`)
- `store-links` — `onAccent` input
- `src/ui/src/styles.scss` — removed old projects styles; Expertise grid 6→3→2→1 breakpoints;
  `.cards` minimum `min(100%, 300px)`
- `sections/expertise/expertise.scss`, `sections/certifications/certifications.scss` — shrink-to-fit
- `src/app/app.spec.ts` — `provideRouter([])`

Responsive pass (PR #9)
- `docs/responsive-plan.md` — the plan, plus a status section listing where the build departs from it
- `src/ui/src/styles/_breakpoints.scss` — new; `bp.up()` / `bp.below()` mixins
- `src/ui/src/styles.scss` — rewritten mobile-first: fluid type and spacing tokens, `--gutter`,
  1440px content cap, reduced-motion guard, focus outlines; dead light theme and navbar rules removed
- `src/ui/angular.json` — `stylePreprocessorOptions.includePaths: ["src/styles"]`
- `components/navbar/*` — brand, menu button, drawer, `links` array, close on Esc/click/NavigationEnd; spec has 7 tests
- `components/footer/footer.html` — `id="contact"`
- `sections/certifications/*` — wrapper flattened; one-row scaling grid (`$cert-count`)
- `sections/hero/hero.scss` — single column with the photo first on phones, row from md; fluid sizes
- `sections/expertise`, `badges`, `projects`, `pages/portfolio-project` SCSS — moved onto the shared breakpoints
- `src/ui/e2e/responsive.spec.ts`, `src/ui/playwright.config.ts` — responsive sweep;
  `@playwright/test` dev dependency; `e2e` script
- `.gitignore` — `ai/screenshots/`, `test-results/`, `playwright-report/`

## Commands

```bash
cd src/ui
npx ng test --watch=false     # vitest via @angular/build:unit-test
npx ng build
npx ng serve --port 4300      # dev server (restart after angular.json changes)
bun run e2e                   # responsive sweep; reuses :4200 or starts ng serve
E2E_BASE_URL=http://localhost:4300 bun run e2e      # against another server
E2E_BASE_URL=https://www.dsylvester.io bun run e2e  # against production
gh pr view 8 --json mergeStateStatus,statusCheckRollup
gh run list --branch main --limit 2   # watch the deploy after a merge
```

Visual checks were done with small Playwright scripts (`bun <script>.mjs`) in the session
scratchpad, against `ng serve`; to hit the live API from localhost, route
`http://localhost:3100/**` to the prod API in Playwright.

## Vocabulary

- **Key figures** — the row of KPI tiles at the top of `/activity` (`section.act-tiles`).
- **Insights** — `snapshot.insights` from the activity API (IaC, stack, PRs, CI/CD, career).
- **Sweep / responsive sweep** — `e2e/responsive.spec.ts`: 8 widths × 4 pages plus the cert-row and nav checks.
  Screenshots go to `ai/screenshots/responsive/` (gitignored); pre-change ones are in `ai/screenshots/baseline/`.
- **base / sm / md / lg / xl** — the breakpoints in `_breakpoints.scss` (0 / 600 / 900 / 1200 / 1536).
- **Professional Projects** — the home-page accent band (component still named `Projects`,
  anchor `#projects`).

## Rules and patterns

- Git: GitHub Flow here (`main` + `feature/*`), conventional commits, merge commits for PRs,
  **never** a Co-Authored-By line; commits end with the `Claude-Session:` line.
- Angular: standalone components, separate HTML/SCSS files, signals; explicit types and return
  types; `type` alias (not interface) only where a framework needs an indexable record.
- Responsive CSS is mobile-first: base rules for phones, then `@include bp.up(md)` and so on.
  Use the tokens (`--fs-*`, `--space-*`, `--gutter`) instead of new per-width font-size overrides.
- Health endpoints are `/activity/health` and `/activity/ready` — never `/healthz`.

## Environment

- Bun 1.4.x, Node 26, Angular 21. `gh` authenticated as DavisSylvester.
- No secrets were created this session.

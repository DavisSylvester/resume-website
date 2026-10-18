# Resume

## Where to pick up

Ask whether to merge **PR #8** (https://github.com/DavisSylvester/resume-website/pull/8), then
merge with a merge commit and delete the branch; the push to `main` deploys automatically.

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

## Commands

```bash
cd src/ui
npx ng test --watch=false     # vitest via @angular/build:unit-test
npx ng build
npx ng serve --port 4300      # dev server
gh pr view 8 --json mergeStateStatus,statusCheckRollup
gh run list --branch main --limit 2   # watch the deploy after a merge
```

Visual checks were done with small Playwright scripts (`bun <script>.mjs`) in the session
scratchpad, against `ng serve`; to hit the live API from localhost, route
`http://localhost:3100/**` to the prod API in Playwright.

## Vocabulary

- **Key figures** — the row of KPI tiles at the top of `/activity` (`section.act-tiles`).
- **Insights** — `snapshot.insights` from the activity API (IaC, stack, PRs, CI/CD, career).
- **Professional Projects** — the home-page accent band (component still named `Projects`,
  anchor `#projects`).

## Rules and patterns

- Git: GitHub Flow here (`main` + `feature/*`), conventional commits, merge commits for PRs,
  **never** a Co-Authored-By line; commits end with the `Claude-Session:` line.
- Angular: standalone components, separate HTML/SCSS files, signals; explicit types and return
  types; `type` alias (not interface) only where a framework needs an indexable record.
- Health endpoints are `/activity/health` and `/activity/ready` — never `/healthz`.

## Environment

- Bun 1.4.x, Node 26, Angular 21. `gh` authenticated as DavisSylvester.
- No secrets were created this session.

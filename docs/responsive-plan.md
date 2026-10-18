# Responsive plan: mobile, tablet, desktop

Drafted 2026-10-18. Scope: the Angular UI in `src/ui`.

## Status: applied 2026-10-18 on `feature/responsive-layout`

All seven items are in. Checks: `bun run e2e` passes 48/48 (8 widths × 4 pages, plus the
certification-row and navbar checks); `ng test` passes 30/30; `ng build` is clean; no console
errors on the Vite dev server at 390px across `/`, `/about`, `/portfolio` and `/activity`.

The navbar drawer closes on toggle, Esc, link click and any completed router navigation
(`NavigationEnd`, subscribed manually rather than through rxjs-interop because of the
NG0203 trap). Experience runs 1 / 2 / 3 columns at base / `md` / `lg`.

Where the implementation differs from the plan below:

- **Navbar at `md`:** no "Sections" dropdown. With the gap tightened to 1.25rem, the full
  inline bar fits from 900px, which the sweep confirms. The gap returns to 2.5rem at `lg`.
- **Theme:** the dark purple theme stays as the only theme. The nested light block never
  applied, so it was deleted rather than wired to `prefers-color-scheme`.
- **Contact button:** it linked to `#contact`, which didn't exist on the home page. The footer
  (which holds the email and phone number) now carries `id="contact"`.
- **Experience:** `.compact { columns: 2 }` was unused, so it was removed instead of made
  responsive.
- **Activity charts:** these already resize with a `ResizeObserver` in `d3-chart.ts`. At
  320px the radial calendar (246px) and the hour-of-week heatmap (280px) both fit inside
  their 288px cards and stay legible, so they don't scroll inside their cards. The page's
  Tables toggle gives the exact numbers.
- **Projects and portfolio detail:** their 560px queries became `bp.below(sm)`, aligning them
  with the shared breakpoint.
- **Shared partial import:** `angular.json` adds `stylePreprocessorOptions.includePaths:
  ["src/styles"]`, so a component writes `@use 'breakpoints' as bp;`. A running `ng serve`
  must be restarted to pick this up.

Run the sweep with `bun run e2e`. It reuses a server on :4200 or starts one, and
`E2E_BASE_URL` points it elsewhere.

## Where things stood (before)

- **Breakpoints vary from file to file.** They're all desktop-first `max-width` queries with
  different values: 1280 / 1024 / 900 / 768 / 600 / 560 / 480. No two components step at the
  same widths.
- **The light theme never applies.** In `styles.scss` the light palette is a `:root` nested
  inside `:root`, which compiles to `:root :root` and matches nothing. The global `.navbar`
  rules have the same problem: half of their declarations sit inside nested `.cards`/`.card`
  blocks.
- **The navbar has no mobile pattern.** It holds 8 links plus a Contact button. Under 768px it
  wraps onto several lines and the sticky bar takes up a large part of a phone screen.
- **Hero text gets too small.** It has three step-downs, and at 480px the tagline is 0.65rem
  (about 10px).
- **Certifications row** (`sections/certifications/certifications.scss`): from 900px up, each
  card is fixed at `flex: 0 0 240px` with `flex-wrap: wrap`. Six cards plus gaps need about
  1,520px, so the row **wraps between 900px and about 1,560px**, which covers most laptops and
  all tablets in landscape.
- Already working: no horizontal overflow at 320 to 1440px (checked with Playwright on
  2026-10-18). Expertise steps through 6, 3, 2 and 1 columns. The global `.cards` grid uses
  `auto-fit/minmax`.

## Target breakpoints (mobile first)

Define these once in `src/styles/_breakpoints.scss` and `@use` that file wherever a component
needs a breakpoint:

| Token | min-width | Devices |
|-------|-----------|---------|
| base  | 0         | phones, 320 to 599 |
| `sm`  | 600px     | large phones, small tablets in portrait |
| `md`  | 900px     | tablets in landscape, small laptops |
| `lg`  | 1200px    | desktop |
| `xl`  | 1536px    | wide desktop (content width is capped) |

```scss
// _breakpoints.scss
$bp: (sm: 600px, md: 900px, lg: 1200px, xl: 1536px);
@mixin up($name) { @media (min-width: map-get($bp, $name)) { @content; } }
```

Base styles target phones. Each larger layout goes inside `@include up(...)`.

## Work items, in order

### 1. Certifications on one row at every width (small, ship first)

Replace the flex-and-wrap layout with a fixed six-column grid that scales its cells:

```scss
.certifications .logo-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: clamp(0.4rem, 1.5vw, 0.9rem);
  max-width: 1500px;
}
.certifications .logo-card { padding: clamp(4px, 0.8vw, 8px); }
.certifications .logo-card img { width: 100%; max-width: 200px; height: auto; max-height: none; }
```

- Remove the `flex: 0 0 240px` rule at 900px and the 480px override.
- Badge size at 320px: about 42px. At 390px: about 52px. At 768px: about 115px. On desktop: up
  to 200px. The badges still read as icons at phone size.
- Use `repeat(6, ...)` and add a short comment explaining it, so that adding a seventh
  certification means changing that number. A data-driven version would set
  `--cert-count` from the template.
- Fold in now: the nested `.card.logos-only` inside `.cards` is an extra wrapper that adds
  padding. Flatten it.
- Verify with Playwright at 320, 390, 600, 768, 1024, 1280, 1440 and 1920: all six badges share
  one `offsetTop` and nothing overflows.

### 2. Global foundation

- Add `_breakpoints.scss` and a set of fluid type tokens built on `clamp()` (`--fs-h1`,
  `--fs-h2`, `--fs-body`, `--fs-small`). Most per-breakpoint font-size overrides can then go,
  which fixes the 0.65rem hero text.
- Add spacing tokens (`--space-1` to `--space-6`) and a `--gutter` that is 16px on phones,
  24px at `md` and 32px at `lg`. `.container` uses `--gutter`.
- Cap content width at `lg` and above: `.container { max-width: 1440px; margin-inline: auto; }`.
- Untangle `styles.scss`: move the nested `:root` and `.navbar` and `.footer` declarations to
  the top level, decide whether the dark or the light theme is the real one (use
  `prefers-color-scheme` if both should exist), and remove the duplicate `.navbar` rules that
  `navbar.scss` already covers.

### 3. Navbar

- **Base and `sm`:** brand on the left, a hamburger `<button aria-expanded>` on the right, and
  a full-width drawer or sheet holding the links and Contact. Close it on link click, on Esc
  and on route change. Use an Angular signal for the state.
- **`md`:** the inline links fit at 900px only if the 4 in-page anchors (Expertise,
  Experience, Projects, Badges) move into a "Sections" dropdown, or into a secondary row that
  appears only on the home page.
- **`lg`:** the full inline bar.
- Touch targets are at least 44px tall. Anchor jumps use `scroll-margin-top` equal to the
  navbar height.

### 4. Hero

- Base: a single column, the photo at about 140 to 160px centered above the name, name and
  tagline sized with `clamp()`, and no fixed `min-height`.
- `md` and up: the current side-by-side layout.
- Drop the three step-down blocks in favour of fluid sizes.

### 5. Section grids

- **Expertise:** rewrite as mobile-first with the same 1 / 2 / 3 / 6 columns at base / `sm` /
  `md` / `lg`.
- **Experience:** remove `.compact { columns: 2 }` on phones; use two columns from `md` up.
- **Badges:** cards stay in the `auto-fit` grid. On phones, shrink the image from 96 to 64px
  and let the meta text wrap.
- **Projects** (Professional Projects band): check that its 560px step matches `sm`, then
  realign it.
- **Portfolio and project detail:** move the 560px query to `sm`.
- **Activity page:** the D3 charts need a `ResizeObserver`-driven width (check whether
  `d3-chart.ts` already has one). The radial calendar and the heatmap scroll horizontally
  inside their own card on phones. The page itself must not scroll sideways.

### 6. Motion and accessibility

- Wrap every transition and transform in a global `prefers-reduced-motion: reduce` guard. At
  the moment only `_activity.scss` respects it.
- Check visible focus styles on the nav drawer, the cards and the badge links.

### 7. Verification

- Add a Playwright spec (`e2e/responsive.spec.ts`) that loops over the widths
  `[320, 390, 600, 768, 1024, 1280, 1440, 1920]` on `/`, `/about`, `/portfolio` and
  `/activity`. For each one, assert:
  - `document.documentElement.scrollWidth <= innerWidth`
  - the six certification badges share one row
  - at base and `sm`, the nav drawer toggle is visible and the inline links are hidden
- Save screenshots per width to `ai/screenshots/responsive/` for review.
- Run `ng test` and `ng build`, then check the Vite dev server by hand (the NG0203 trap only
  shows up there).

## Suggested PR split

1. `fix: keep all certification badges on one row` (item 1 only, quick win)
2. `refactor: mobile-first breakpoints, tokens, and styles.scss cleanup` (item 2)
3. `feat: responsive navbar with mobile drawer` (item 3)
4. `refactor: mobile-first hero and section grids` (items 4 and 5)
5. `test: responsive Playwright sweep` (items 6 and 7)

If the Claude Design redesign goes ahead, PRs 3 and 4 are likely to be replaced by it. Ship 1,
2 and 5 regardless, since the redesign will build on the tokens and the test sweep.

import { expect, test, type Page } from '@playwright/test';

/**
 * Responsive sweep: every page, at every target width, must fit the viewport
 * without sideways scrolling. The home page additionally keeps all certification
 * badges on one row and swaps the inline nav for a drawer toggle on small screens.
 *
 * Screenshots land in ai/screenshots/responsive/ for visual review.
 */

const WIDTHS: number[] = [320, 390, 600, 768, 1024, 1280, 1440, 1920];
const PAGES: string[] = ['/', '/about', '/portfolio', '/activity'];
/** Below this width the navbar collapses into the drawer (the `md` breakpoint). */
const NAV_DRAWER_MAX: number = 900;

const slug = (path: string): string => (path === '/' ? 'home' : path.replace(/\//g, ''));

const settle = async (page: Page): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForLoadState('networkidle');
};

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    for (const path of PAGES) {
      test(`${path} has no horizontal overflow`, async ({ page }) => {
        await page.goto(path);
        await settle(page);

        const overflow: number = await page.evaluate(
          (): number => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow, `page is ${overflow}px wider than the viewport`).toBeLessThanOrEqual(0);

        await page.screenshot({
          path: `../../ai/screenshots/responsive/${slug(path)}-${width}.png`,
          fullPage: true,
        });
      });
    }

    test('certification badges share one row', async ({ page }) => {
      await page.goto('/');
      await settle(page);

      const cards = page.locator('.certifications .logo-card');
      await expect(cards).toHaveCount(6);
      const tops: number[] = await cards.evaluateAll((els: Element[]): number[] =>
        els.map((el: Element): number => Math.round(el.getBoundingClientRect().top)),
      );
      expect(new Set(tops).size, `badge tops: ${tops.join(', ')}`).toBe(1);
    });

    test('navbar shows the right navigation for the width', async ({ page }) => {
      await page.goto('/');
      await settle(page);

      const toggle = page.getByRole('button', { name: /menu/i });
      const inlineLinks = page.locator('.navbar .nav-links');

      if (width < NAV_DRAWER_MAX) {
        await expect(toggle).toBeVisible();
        await expect(inlineLinks).toBeHidden();

        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator('#nav-drawer')).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      } else {
        await expect(toggle).toBeHidden();
        await expect(inlineLinks).toBeVisible();
      }
    });
  });
}

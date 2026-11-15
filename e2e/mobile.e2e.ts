import { expect, test, type Page } from '@playwright/test';

/** Ankara 01: one charge at the foot of the columns clears it (its near-miss clear rate is 100%). */
const WIN = { x: 600, y: 470 };
/** Inside the charge zone, too far from the structure to bring anything down. */
const MISS = { x: 400, y: 460 };

/** A new player, in English, with the sound off. */
const freshPlayer = (page: Page) =>
  page.addInitScript(() => {
    if (localStorage.getItem('fuse-and-fall/progress')) return;
    localStorage.setItem(
      'fuse-and-fall/progress',
      JSON.stringify({ version: 1, stars: {}, settings: { language: 'en', sfxVolume: 0, musicVolume: 0 } }),
    );
  });

/** Everything the page complains about; a test that ends with any of it fails. */
const watchErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
};

/** Taps a point of the game world with a finger, through the real touch input. */
const tapWorld = async (page: Page, at: { x: number; y: number }) => {
  const p = await page.evaluate(
    ([x, y]) => (window as unknown as { __fuse: { toClient(x: number, y: number): { x: number; y: number } } }).__fuse.toClient(x, y),
    [at.x, at.y] as const,
  );
  await page.touchscreen.tap(p.x, p.y);
};

const usedCharges = (page: Page) => page.locator('.hud .pip.used');

test.beforeEach(async ({ page }) => {
  await freshPlayer(page);
});

test('the main menu fits the screen without scrolling', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./');
  const menu = page.locator('.panel.menu');
  await expect(menu).toBeVisible();
  const fit = await menu.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      scrolls: el.scrollHeight > el.clientHeight + 1,
      inside: r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight + 1 && r.right <= window.innerWidth + 1,
    };
  });
  expect(fit).toEqual({ scrolls: false, inside: true });
  // Every menu button is big enough for a finger.
  const heights = await menu.locator('button').evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect().height));
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(36);
  expect(errors).toEqual([]);
});

test('a job plays through: a miss, a retry that keeps the charge, a win, and skip', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./');
  await page.locator('.btn.continue').tap();
  const fire = page.locator('.fire-btn:not(.detonate-btn)');
  await expect(fire).toBeVisible();

  // A charge too far away: the job fails, and quickly, because nothing moves.
  await tapWorld(page, MISS);
  await expect(usedCharges(page)).toHaveCount(1);
  await fire.tap();
  await expect(page.locator('.panel.report.lose')).toBeVisible({ timeout: 15_000 });

  // Try again from the report: the charge is back where it was.
  await page.locator('.report .actions .btn').first().tap();
  await expect(fire).toBeVisible();
  await expect(usedCharges(page)).toHaveCount(1);
  await expect(page.locator('.toast.visible')).toContainText('back in place');

  // Try again while placing: a clean field.
  await page.locator('.hud-actions button[aria-label="Try again"]').tap();
  await expect(usedCharges(page)).toHaveCount(0);

  // The right spot: the structure comes down, Skip jumps to the report, and the job is won.
  await tapWorld(page, WIN);
  await expect(usedCharges(page)).toHaveCount(1);
  await fire.tap();
  const skip = page.locator('.skip-btn');
  await expect(skip).toBeVisible({ timeout: 10_000 });
  await skip.tap();
  const report = page.locator('.panel.report');
  await expect(report).toBeVisible({ timeout: 5_000 });
  await expect(report).not.toHaveClass(/lose/);
  await expect(skip).toBeHidden();

  // The report's buttons are on screen, not under the edge.
  const next = report.locator('.actions .btn.primary');
  await expect(next).toBeInViewport();
  expect(errors).toEqual([]);
});

test('the fire button and the HUD stay inside the screen', async ({ page }) => {
  await page.goto('./');
  await page.locator('.btn.continue').tap();
  for (const selector of ['.fire-btn:not(.detonate-btn)', '.hud-info', '.hud-actions']) {
    const el = page.locator(selector);
    await expect(el).toBeVisible();
    const inside = await el.evaluate((node) => {
      const r = node.getBoundingClientRect();
      return r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth;
    });
    expect(inside, selector).toBe(true);
  }
});

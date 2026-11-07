import { expect, test } from '@playwright/test';

test('reading layout keeps each service and its folder inside the grid column', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ height: 900, width });
    const panel = page.locator('.service-panel').first();
    await panel.scrollIntoViewIfNeeded();
    const columnCount = width > 760 ? 2 : 1;
    const grid = await page.locator('#works-track').boundingBox();
    const bounds = await panel.boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(grid!.width / columnCount + 1);
    const folder = await panel.locator('.folder-float__folder').boundingBox();
    expect(folder!.x).toBeGreaterThanOrEqual(bounds!.x);
    expect(folder!.x + folder!.width).toBeLessThanOrEqual(
      bounds!.x + bounds!.width,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

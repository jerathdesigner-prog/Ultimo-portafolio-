import { expect, test } from '@playwright/test';

test('recognition controls support clicks, keyboard and a document preview', async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  const previous = page.locator('#awards-prev');
  const next = page.locator('#awards-next');
  const track = page.locator('#awards-track');
  await previous.scrollIntoViewIfNeeded();
  await expect(previous).toBeDisabled();
  await next.click();
  await expect
    .poll(() => track.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(100);
  await expect(previous).toBeEnabled();
  await previous.focus();
  await page.keyboard.press('Enter');
  await expect
    .poll(() => track.evaluate((element) => element.scrollLeft))
    .toBeLessThan(2);
  const bounds = await next.boundingBox();
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
  await page.locator('.award-card').first().click();
  await expect(page.locator('#award-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#award-dialog')).not.toBeVisible();
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ height: 900, width });
    await page.locator('.recognition-navigation').scrollIntoViewIfNeeded();
    const controls = await page
      .locator('.recognition-navigation')
      .boundingBox();
    const heading = await page.locator('.awards-intro').boundingBox();
    expect(Math.abs(controls!.x - heading!.x)).toBeLessThan(1);
    expect(controls!.x + controls!.width).toBeLessThanOrEqual(width - 19);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

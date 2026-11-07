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
  const track = page.locator('#awards-track');
  await expect(track).toHaveClass(/card-swap/);
  await track.scrollIntoViewIfNeeded();
  await track.focus();
  await page.keyboard.press('ArrowRight');
  await expect(track.locator('[data-front]')).toHaveAttribute(
    'data-swap-index',
    '1',
  );
  await page.keyboard.press('ArrowLeft');
  await expect(track.locator('[data-front]')).toHaveAttribute(
    'data-swap-index',
    '0',
  );
  await track.locator('[data-front] .award-card').click();
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

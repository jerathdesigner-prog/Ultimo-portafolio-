import { expect, test } from '@playwright/test';

test('recognition stack rotates, pauses and opens the original certificate', async ({
  page,
}) => {
  test.setTimeout(45000);
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto('/');
  await expect(page.locator('#jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  const stack = page.locator('#awards-track');
  await expect(stack).toHaveClass(/card-swap/);
  await stack.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  const front = stack.locator('[data-front]');
  const initial = await front.getAttribute('data-swap-index');
  await expect
    .poll(() => front.getAttribute('data-swap-index'), { timeout: 7000 })
    .not.toBe(initial);
  await expect(
    page.locator('#awards-pause, #awards-prev, #awards-next'),
  ).toHaveCount(0);
  await front.locator('.award-card').hover();
  const paused = await front.getAttribute('data-swap-index');
  await page.waitForTimeout(4200);
  await expect(front).toHaveAttribute('data-swap-index', paused!);
  await page.screenshot({
    path: 'output/playwright/recognition-swap-desktop.png',
  });
  await front.locator('.award-card').click();
  await expect(page.locator('#award-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#award-dialog')).not.toBeVisible();
  const dragged = await front.getAttribute('data-swap-index');
  const cardBounds = await front.locator('.award-card').boundingBox();
  await page.mouse.move(
    cardBounds!.x + cardBounds!.width / 2,
    cardBounds!.y + cardBounds!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    cardBounds!.x + cardBounds!.width / 2 - 180,
    cardBounds!.y + cardBounds!.height / 2 - 40,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect
    .poll(() => front.getAttribute('data-swap-index'))
    .not.toBe(dragged);
  await expect(page.locator('#award-dialog')).not.toBeVisible();
  await page.setViewportSize({ height: 844, width: 390 });
  await stack.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(stack.locator('.award-card')).toHaveCount(12);
  await page.screenshot({
    path: 'output/playwright/recognition-swap-mobile.png',
  });
});

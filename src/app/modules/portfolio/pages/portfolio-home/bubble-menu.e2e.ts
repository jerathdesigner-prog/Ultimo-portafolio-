import { expect, test } from '@playwright/test';

for (const [width, height] of [
  [320, 568],
  [844, 390],
  [1440, 900],
]) {
  test(`bubble menu is compact and keyboard accessible at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ height, width });
    await page.goto('/');
    await expect(page.locator('.jm-preloader')).toHaveCount(0, {
      timeout: 15000,
    });
    const toggle = page.locator('#menu-toggle');
    const navigation = page.locator('#navigation');
    await expect(page.locator('.bubble-brand')).toHaveCount(0);
    await expect(navigation).toBeHidden();
    await expect(toggle).toHaveAccessibleName('Abrir menú');
    const button = await toggle.boundingBox();
    expect(button!.width).toBeLessThanOrEqual(52);
    expect(button!.height).toBeGreaterThanOrEqual(44);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(navigation.locator('.bubble-link')).toHaveCount(5);
    await expect(navigation).toBeVisible();
    const dropdown = await navigation.boundingBox();
    expect(dropdown!.width).toBeLessThanOrEqual(220);
    expect(dropdown!.height).toBeLessThanOrEqual(300);
    expect(dropdown!.x).toBeGreaterThan(width - 260);
    await navigation.locator('a').first().focus();
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
    await expect(navigation).toBeHidden();
    // A rapid close/reopen must not leave an invisible, expanded menu.
    await toggle.click();
    await toggle.click();
    await toggle.click();
    await expect(navigation).toHaveClass(/is-open/);
    await expect(navigation.locator('a').last()).toHaveCSS('opacity', '1');
    for (const link of await navigation.locator('a').all()) {
      await expect(link).toBeInViewport({ ratio: 1 });
    }
    await page.screenshot({
      animations: 'disabled',
      path: `output/playwright/bubble-menu-${width}.png`,
    });
    await navigation.locator('a[href="#inicio"]').click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(navigation).toBeHidden();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await toggle.click();
    await expect(navigation.locator('a').first()).toHaveCSS(
      'transition-duration',
      '0s',
    );
    await page.mouse.click(width / 2, height - 10);
    await expect(navigation).toBeHidden();
  });
}

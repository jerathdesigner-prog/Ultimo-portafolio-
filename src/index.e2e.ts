import { expect, test } from '@playwright/test';

for (const reduced of [false, true]) {
  test(`cube preloader reveals the portfolio${reduced ? ' with reduced motion' : ''}`, async ({
    page,
  }) => {
    await page.emulateMedia({
      reducedMotion: reduced ? 'reduce' : 'no-preference',
    });
    await page.setViewportSize({ height: 900, width: reduced ? 320 : 1440 });
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(
      /\/static\/media\/(?:hero-character-\d+|a0ea6851412f)\.webp/,
      async (route) => {
        await ready;
        await route.continue();
      },
    );
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const cubes = page.locator('.jm-preloader .cube');
    await expect(cubes).toHaveCount(8);
    await expect(page.locator('.jm-preloader__track')).toHaveCount(0);
    expect(await cubes.locator('.face-front').allTextContents()).toEqual([
      ...'CARGANDO',
    ]);
    expect(await page.locator('.jm-preloader .face').count()).toBe(48);
    const bounds = await page.locator('.wrapper-grid').boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(reduced ? 320 : 1440);
    if (reduced)
      expect(
        await cubes
          .first()
          .evaluate((el) => getComputedStyle(el).animationName),
      ).toBe('none');
    else
      await expect
        .poll(() =>
          cubes
            .first()
            .locator('.face-front')
            .evaluate((el) => el.getAnimations().length),
        )
        .toBe(3);
    await page.screenshot({
      path: `output/playwright/portfolio-loader-${reduced ? 'mobile-reduced' : 'desktop'}.png`,
    });
    release();
    if (!reduced) {
      await expect(page.locator('#jm-preloader')).toHaveClass(/jm-revealing/, {
        timeout: 12000,
      });
      expect(
        await page.evaluate(() => performance.now()),
      ).toBeGreaterThanOrEqual(4550);
    }
    await expect(page.locator('#jm-preloader')).toHaveCount(0, {
      timeout: 15000,
    });
    await expect(page.locator('html')).not.toHaveClass(/jm-preloading/);
    await expect(page.locator('#hero-character')).toBeVisible();
    await expect(page.locator('#site-header')).toHaveCSS('position', 'fixed');
    const stylesheet = await page
      .locator('link[rel="stylesheet"]')
      .first()
      .getAttribute('href');
    const css = await page.request.get(stylesheet!);
    expect(css.status()).toBe(200);
    expect((await css.text()).length).toBeGreaterThan(50000);
    await page.screenshot({
      path: `output/playwright/portfolio-restored-${reduced ? 'mobile' : 'desktop'}.png`,
    });
  });
}

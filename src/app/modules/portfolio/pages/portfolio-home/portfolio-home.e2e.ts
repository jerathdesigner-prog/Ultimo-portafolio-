import { expect, test } from '@playwright/test';

test('character scroll motion is gradual and the first mobile scene has no zoom jump', async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto('/');
  await expect(page.locator('.jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  const zoomAt = (progress: number) =>
    page.evaluate(async (p) => {
      window.scrollTo({ behavior: 'instant', top: innerHeight * 6.1 * p });
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      return Number(
        document
          .querySelector<HTMLElement>('#character-wrap')!
          .style.transform.match(/scale\(([^)]+)\)/)![1],
      );
    }, progress);
  const before = await zoomAt(0.114);
  const after = await zoomAt(0.116);
  expect(Math.abs(after - before)).toBeLessThan(0.005);
  await expect(page.locator('#character-wrap')).toHaveCSS(
    'transition-property',
    'transform',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#character-wrap')).toHaveCSS(
    'transition-duration',
    '0s',
  );
});

test('Desliza settles the character at the first story on desktop and mobile', async ({
  page,
}) => {
  for (const [width, height, scale] of [
    [1440, 900, 1.35],
    [390, 844, 1.18],
  ]) {
    await page.setViewportSize({ height, width });
    await page.goto('/');
    await expect(page.locator('.jm-preloader')).toHaveCount(0, {
      timeout: 15000,
    });
    await page.locator('.scroll-cue').click();
    await expect(page.locator('#story-one')).toHaveAttribute(
      'aria-hidden',
      'false',
    );
    await expect
      .poll(() =>
        page
          .locator('#character-wrap')
          .evaluate(
            (element) => new DOMMatrix(getComputedStyle(element).transform).a,
          ),
      )
      .toBeCloseTo(scale, 2);
    await page.screenshot({
      path: `output/playwright/scroll-review/first-story-${width}.png`,
    });
    await page.mouse.wheel(0, -250);
    await page.waitForTimeout(500);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test('services navigation reveals usable project controls', async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto('/');
  await expect(page.locator('.jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  await page.locator('#menu-toggle').click();
  await page.locator('#navigation a[href="#servicios"]').click();
  const project = page.locator('.service-list button').first();
  await expect
    .poll(async () => (await project.boundingBox())!.x)
    .toBeLessThan(100);
  await project.click();
  await expect(page.locator('#service-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#service-dialog')).not.toBeVisible();
});

for (const [width, height] of [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1440, 900],
  [1920, 1080],
  [844, 390],
]) {
  test(`layout ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ height, width });
    await page.goto('/');
    await expect(page.locator('#hero-character')).toBeVisible();
    await expect(page.locator('.jm-preloader')).toHaveCount(0, {
      timeout: 15000,
    });
    await expect(page.locator('#menu-toggle')).toHaveCSS('min-height', '44px');
    await page.locator('#menu-toggle').click();
    await expect(page.locator('#navigation')).toBeVisible();
    const nav = await page.locator('#navigation').boundingBox();
    expect(nav!.y + nav!.height).toBeLessThanOrEqual(height);
    await page.locator('#navigation a').first().focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#menu-toggle')).toBeFocused();
    for (const portion of [0, 0.15, 0.5, 0.8, 1]) {
      await page.evaluate(
        (p) =>
          window.scrollTo({
            behavior: 'instant',
            top: (document.documentElement.scrollHeight - innerHeight) * p,
          }),
        portion,
      );
      await page.waitForTimeout(200);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 390 || width === 1440) {
        await page.screenshot({
          path: `output/playwright/section-${width}-${portion}.png`,
        });
      }
    }
    await page.evaluate(() => window.scrollTo({ behavior: 'instant', top: 0 }));
    await expect(page.locator('#intro-copy')).toHaveCSS('opacity', '1');
    await page.locator('#menu-toggle').blur();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `output/playwright/hero-${width}x${height}.png`,
    });
  });
}

test('reduced motion exposes all stories and services in reading order', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  await expect(page.locator('#inicio')).toHaveClass(/reading-layout/);
  for (const story of await page.locator('.jm-story').all()) {
    await expect(story).toHaveAttribute('aria-hidden', 'false');
    await expect(story).toHaveCSS('opacity', '1');
  }
  await page.locator('#menu-toggle').click();
  await page.locator('#navigation a[href="#sobre-mi"]').click();
  await expect(page.locator('#story-one')).toBeInViewport();
  await page.evaluate(() => window.scrollTo({ behavior: 'instant', top: 0 }));
  await page.locator('#menu-toggle').click();
  await page.locator('#navigation a[href="#servicios"]').click();
  await expect(page.locator('.service-panel').first()).toBeInViewport();
  for (const panel of await page.locator('.service-panel').all()) {
    const artwork = await panel.locator('.sample-button').boundingBox();
    const list = await panel.locator('.service-list').boundingBox();
    expect(list!.y).toBeGreaterThanOrEqual(artwork!.y + artwork!.height);
  }
  expect(await page.locator('canvas').count()).toBe(0);
  await page.screenshot({
    fullPage: true,
    path: 'output/playwright/reduced-motion.png',
  });
});

test('touch phone loads one responsive character image and no GLB', async ({
  browser,
}) => {
  const page = await browser.newPage({
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    viewport: { height: 844, width: 390 },
  });
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('http://localhost:8787');
  await expect(page.locator('.jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  await expect(page.locator('#hero-character')).toHaveJSProperty(
    'currentSrc',
    'http://localhost:8787/static/media/hero-character-1024.webp',
  );
  expect(
    requests.filter((url) => /hero-character-\d+\.webp/.test(url)),
  ).toHaveLength(1);
  expect(requests.some((url) => /\.(glb|gltf)(\?|$)/.test(url))).toBe(false);
  await expect(page.locator('.hero-character__head')).toHaveCSS(
    'filter',
    'none',
  );
  await page.screenshot({ path: 'output/playwright/touch-phone.png' });
  await page.close();
});

test('continuous character stays intact across all cursor extremes', async ({
  page,
}) => {
  await page.setViewportSize({ height: 1000, width: 1440 });
  await page.goto('/');
  await expect(page.locator('.jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  const head = page.locator('.hero-character__head');
  await expect(head.locator('img')).toHaveCount(2); // illustration + eye patch
  await expect(head).toHaveCSS('transform-origin', /./);
  await expect(head).toHaveCSS('mask-image', 'none');
  await expect(head).toHaveCSS('filter', 'none');
  await expect(page.locator('app-hero-character filter')).toHaveCount(0);
  for (const [x, y] of [
    [0, 0],
    [720, 0],
    [1439, 0],
    [1439, 500],
    [1439, 999],
    [720, 999],
    [0, 999],
    [0, 500],
  ]) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(650);
    await expect(head).not.toHaveCSS('transform', 'none');
    await page.screenshot({
      path: `output/playwright/continuous-extreme-${x}-${y}.png`,
    });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(head).toHaveCSS('transform', 'none');
});

test('head and eyes track the cursor, then stop on a live motion preference change', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  const head = page.locator('.hero-character__head');
  const pupil = page.locator('.hero-eyes__pupil').first();
  const initial = await pupil.getAttribute('style');
  await page.mouse.move(1200, 100);
  await expect.poll(() => pupil.getAttribute('style')).not.toBe(initial);
  await expect(head).not.toHaveCSS('transform', 'none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(head).toHaveCSS('transform', 'none');
  await expect.poll(() => pupil.getAttribute('style')).toBe(initial);
  const resting = await pupil.getAttribute('style');
  await page.mouse.move(20, 500);
  await page.waitForTimeout(250);
  expect(await pupil.getAttribute('style')).toBe(resting);
});

import { expect, test } from '@playwright/test';

test('offscreen contact artwork waits until contact approaches the viewport', async ({
  page,
}) => {
  const downloads: string[] = [];
  page.on('request', (request) => downloads.push(request.url()));
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  expect(
    downloads.some((url) => /contact-(band|card-front)\.svg/.test(url)),
  ).toBe(false);
  await page.locator('#contacto').scrollIntoViewIfNeeded();
  await expect
    .poll(() => downloads.some((url) => url.endsWith('/contact-band.svg')))
    .toBe(true);
  await expect(page.locator('.lanyard-fallback img')).toHaveJSProperty(
    'complete',
    true,
  );
  await expect(page.locator('.lanyard-fallback img')).toHaveJSProperty(
    'naturalWidth',
    640,
  );
});

test('animated title reuses computed appearance between actual style changes', async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto('/');
  await expect(page.locator('.jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  const title = page.locator('app-portfolio-tech-text');
  await expect(title).toHaveClass(/is-ready/);
  const bounds = await title.boundingBox();
  await page.mouse.move(
    bounds!.x + bounds!.width * 0.38,
    bounds!.y + bounds!.height * 0.5,
  );
  const reads = await title.evaluate(async (element) => {
    const original = window.getComputedStyle;
    let count = 0;
    window.getComputedStyle = (...args) => {
      if (args[0] === element) count++;
      return original(...args);
    };
    try {
      for (let i = 0; i < 20; i++) await new Promise(requestAnimationFrame);
      return count;
    } finally {
      window.getComputedStyle = original;
    }
  });
  expect(reads).toBeLessThanOrEqual(4);
});

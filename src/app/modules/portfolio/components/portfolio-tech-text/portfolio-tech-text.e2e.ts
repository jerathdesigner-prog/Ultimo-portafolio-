import { expect, test } from '@playwright/test';

test('portfolio title renders TechText and preserves the responsive hero', async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto('/');
  await expect(page.locator('#jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  await expect(
    page.getByRole('heading', { exact: true, name: 'PORTAFOLIO' }),
  ).toBeVisible();
  await expect(page.locator('.hero-role')).toHaveText(
    'Jerath Moreira · Diseñador Gráfico & Director Creativo',
  );
  const title = page.locator('app-portfolio-tech-text');
  await expect(title).toHaveClass(/is-ready/);
  const canvas = title.locator('canvas');
  expect(
    await canvas.evaluate((el) => (el as HTMLCanvasElement).width),
  ).toBeGreaterThan(100);
  const bounds = await title.boundingBox();
  const drawing = await canvas.boundingBox();
  expect(drawing!.x).toBeCloseTo(0, 0);
  expect(drawing!.y).toBeCloseTo(0, 0);
  expect(drawing!.width).toBe(1440);
  expect(drawing!.height).toBe(900);
  await page.mouse.move(
    bounds!.x + bounds!.width * 0.38,
    bounds!.y + bounds!.height * 0.5,
  );
  await expect(title).toHaveCSS('cursor', 'grab');
  await page.mouse.down();
  await page.mouse.move(
    bounds!.x + bounds!.width * 0.38 + 15,
    bounds!.y + bounds!.height * 0.5 - 20,
    { steps: 5 },
  );
  await expect(title).toHaveCSS('cursor', 'grabbing');
  await page.mouse.move(1320, 160, { steps: 12 });
  await expect
    .poll(() =>
      canvas.evaluate((el) => {
        const surface = el as HTMLCanvasElement;
        const ratio = surface.width / innerWidth;
        const pixels = surface
          .getContext('2d')!
          .getImageData(
            1220 * ratio,
            60 * ratio,
            200 * ratio,
            200 * ratio,
          ).data;
        let white = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          if (
            pixels[index] > 220 &&
            pixels[index + 1] > 220 &&
            pixels[index + 2] > 220 &&
            pixels[index + 3] > 200
          )
            white++;
        }
        return white;
      }),
    )
    .toBeGreaterThan(500);
  await page.screenshot({
    path: 'output/playwright/tech-text-fullscreen-drag.png',
  });
  await page.mouse.up();
  const afterDrag = await title.boundingBox();
  expect(afterDrag!.width).toBe(bounds!.width);
  expect(afterDrag!.height).toBe(bounds!.height);
  await page.screenshot({ path: 'output/playwright/tech-text-desktop.png' });
  await expect(page.locator('#site-header')).toHaveCSS('position', 'fixed');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(title).not.toHaveClass(/is-ready/);
  await page.setViewportSize({ height: 844, width: 390 });
  await title.scrollIntoViewIfNeeded();
  const mobile = await title.boundingBox();
  expect(mobile!.x).toBeGreaterThanOrEqual(0);
  expect(mobile!.x + mobile!.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: 'output/playwright/tech-text-mobile.png' });
});

import { expect, test } from '@playwright/test';

test('Poppins loads locally and keeps the portfolio within the viewport', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  await page.evaluate(() => document.fonts.ready);
  for (const weight of [400, 500, 600, 700]) {
    expect(
      await page.evaluate(
        (value) => document.fonts.check(`${value} 16px Poppins`),
        weight,
      ),
    ).toBe(true);
  }
  await expect(page.locator('body')).toHaveCSS(
    'font-family',
    'Poppins, Arial, sans-serif',
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ height: 900, width });
    for (const id of ['inicio', 'servicios', 'contacto']) {
      await page.locator(`#${id}`).evaluate((element) => {
        window.scrollTo({
          behavior: 'instant',
          top: element.getBoundingClientRect().top + window.scrollY,
        });
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
});

test('standalone legal pages can load their licensed local font', async ({
  page,
}) => {
  const response = await page.goto('/legal/privacidad');
  expect(response!.headers()['content-security-policy']).toContain(
    "font-src 'self'",
  );
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() =>
      [...document.fonts].some(
        (font) => font.family === 'Poppins' && font.status === 'loaded',
      ),
    ),
  ).toBe(true);
});

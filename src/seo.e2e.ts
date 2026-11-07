import { expect, test } from '@playwright/test';

test('search metadata is consistent and Angular replaces the initial HTML', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Jerath Moreira — Diseñador gráfico');
  await expect(page.locator('.jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  await expect(page).toHaveTitle('Jerath Moreira — Diseñador gráfico');
  await expect(page.locator('.portfolio-fallback')).toHaveCount(0);
  await expect(page.locator('#hero-character')).toBeVisible();
  await expect(page.locator('.hero-role')).toHaveText(
    'Jerath Moreira · Diseñador gráfico',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://jerathmoreira.com/',
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'Jerath Moreira — Diseñador gráfico',
  );
});

test('homepage remains useful without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(
      page.getByRole('heading', { exact: true, name: 'Jerath Moreira' }),
    ).toBeVisible();
    await expect(page.locator('.jm-preloader')).toBeHidden();
    await expect(
      page.getByRole('heading', { exact: true, name: 'Servicios' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'jerathdesigner@gmail.com' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { exact: true, name: 'Privacidad' }),
    ).toHaveAttribute('href', '/legal/privacidad');
  } finally {
    await context.close();
  }
});

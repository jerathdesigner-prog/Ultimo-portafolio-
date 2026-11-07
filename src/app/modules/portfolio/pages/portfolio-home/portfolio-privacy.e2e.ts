import { expect, test } from '@playwright/test';

test('analytics needs a choice and withdrawal stops collection', async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  const events: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/analytics'))
      events.push(request.postData() || '');
  });
  await page.goto('/');
  await expect(page.locator('.jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  await expect(page.locator('#jm-privacy-banner')).toBeVisible();
  const banner = await page.locator('#jm-privacy-banner').boundingBox();
  expect(banner!.width).toBeLessThanOrEqual(340);
  expect(banner!.height).toBeLessThan(230);
  expect(
    await page.evaluate(() => sessionStorage.getItem('jm-visit')),
  ).toBeNull();
  expect(events).toHaveLength(0);
  await page
    .getByRole('button', { exact: true, name: 'Solo necesarias' })
    .click();
  await expect(page.locator('#jm-privacy-banner')).toBeHidden();
  await page.reload();
  await expect(page.locator('.jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  await expect(page.locator('#jm-privacy-banner')).toBeHidden();
  expect(events).toHaveLength(0);
  await page
    .locator('[data-privacy-settings]')
    .evaluate((button: HTMLElement) => button.click());
  await page
    .getByRole('button', { exact: true, name: 'Aceptar analítica' })
    .click();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('jm-visit')))
    .not.toBeNull();
  // Playwright's HeadlessChrome is intentionally excluded server-side as a bot.
  await expect.poll(() => events.length).toBe(1);
  await page
    .locator('[data-privacy-settings]')
    .evaluate((button: HTMLElement) => button.click());
  await page
    .getByRole('button', { exact: true, name: 'Solo necesarias' })
    .click();
  await expect(page.locator('#jm-privacy-banner')).toBeHidden();
  expect(
    await page.evaluate(() => sessionStorage.getItem('jm-visit')),
  ).toBeNull();
  const count = events.length;
  await page.evaluate(() =>
    document
      .querySelector<HTMLAnchorElement>('a[href^="mailto:"]')
      ?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      ),
  );
  expect(events.length).toBe(count);
});

test('brief requires two separate boxes; no project data is posted; receipt is included', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  await page.locator('#jm-privacy-banner .jm-privacy-close').click();
  await page
    .locator('#brief-dialog')
    .evaluate((dialog: HTMLDialogElement) => dialog.showModal());
  await page.locator('#client-idea').fill('PRIVATE PROJECT IDEA');
  const terms = page.locator('#brief-form input[name="terms"]');
  const privacy = page.locator('#brief-form input[name="privacy"]');
  await expect(terms).not.toBeChecked();
  await expect(privacy).not.toBeChecked();
  await expect(page.locator('#client-name')).not.toHaveAttribute('required');
  expect(
    await page
      .locator('#brief-form')
      .evaluate((form: HTMLFormElement) => form.checkValidity()),
  ).toBe(false);
  await terms.check();
  expect(
    await page
      .locator('#brief-form')
      .evaluate((form: HTMLFormElement) => form.checkValidity()),
  ).toBe(false);
  await privacy.check();
  const acceptanceRequest = page.waitForRequest(
    (request) =>
      request.url().endsWith('/api/consent') && request.method() === 'POST',
  );
  const download = page.waitForEvent('download');
  await page.locator('#download-brief').click();
  const sent = (await acceptanceRequest).postDataJSON();
  expect(sent).toMatchObject({
    method: 'download',
    privacy: true,
    purpose: 'brief',
    terms: true,
  });
  expect(JSON.stringify(sent)).not.toContain('PRIVATE PROJECT IDEA');
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const content = Buffer.concat(chunks).toString();
  expect(content).toContain('PRIVATE PROJECT IDEA');
  expect(content).toContain('Justificante:');
  expect(content).toContain('Versión legal:');
});

test('legal pages work without JavaScript and old webfont is not distributed', async ({
  request,
}) => {
  for (const slug of ['terminos', 'privacidad', 'cookies', 'reembolsos']) {
    const response = await request.get(`/legal/${slug}`);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('Jerath');
    expect(await response.text()).not.toContain('Versión en revisión');
  }
  expect((await request.get('/static/media/19943b6e5746.woff2')).status()).toBe(
    404,
  );
  expect((await request.get('/api/admin/privacy-receipts')).status()).toBe(401);
});

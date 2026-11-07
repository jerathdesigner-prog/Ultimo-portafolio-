import { expect, test } from '@playwright/test';

test('contact reflection follows the pointer without resizing the WhatsApp link', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto('/');
  await expect(page.locator('#jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  await page.evaluate(() =>
    window.scrollTo({ behavior: 'instant', top: document.body.scrollHeight }),
  );
  const button = page.getByRole('link', {
    name: 'Hablemos de tu proyecto por WhatsApp',
  });
  await expect(button).toHaveClass(/specular-contact/);
  await expect(button).toHaveAttribute('href', 'https://wa.me/593964143410');
  const size = await button.boundingBox();
  await button.evaluate((el) => el.classList.remove('specular-contact'));
  const original = await button.boundingBox();
  expect(size!.width).toBeCloseTo(original!.width, 1);
  expect(size!.height).toBeCloseTo(original!.height, 1);
  await button.evaluate((el) => el.classList.add('specular-contact'));
  await expect
    .poll(async () => {
      const current = await button.boundingBox();
      await page.mouse.move(
        current!.x + current!.width * 0.75,
        current!.y + current!.height / 2,
      );
      return button.evaluate((el) =>
        el.style.getPropertyValue('--specular-strength'),
      );
    })
    .toBe('1');
  await page.screenshot({
    path: 'output/playwright/contact-specular-desktop.png',
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect
    .poll(() =>
      button.evaluate((el) => el.style.getPropertyValue('--specular-strength')),
    )
    .toBe('');
  await button.focus();
  await expect(button).toBeFocused();
  await expect(button).toHaveCSS('outline-style', 'solid');
  await page.setViewportSize({ height: 844, width: 390 });
  await button.scrollIntoViewIfNeeded();
  expect((await button.boundingBox())!.width).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: 'output/playwright/contact-specular-mobile.png',
  });
});

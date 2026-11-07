import { expect, test } from '@playwright/test';

for (const viewport of [
  { height: 888, width: 1180 },
  { height: 1080, width: 1440 },
]) {
  test(`recognition stays framed during successive scrolls at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('#jm-preloader')).toHaveCount(0, {
      timeout: 15000,
    });
    const shell = page.locator('.contact-reveal-shell');
    const frames: { height: number; titleTop: number }[] = [];
    for (const progress of [0, 0.12, 0.3, 0.55, 0.9]) {
      await shell.evaluate((el, value) => {
        scrollTo({
          behavior: 'instant',
          top:
            scrollY +
            el.getBoundingClientRect().top +
            Number((el as HTMLElement).dataset['revealDistance']) * value,
        });
      }, progress);
      await expect
        .poll(() =>
          page
            .locator('#contacto')
            .evaluate((el) =>
              Number(
                (el as HTMLElement).style.getPropertyValue(
                  '--contact-progress',
                ),
              ),
            ),
        )
        .toBeCloseTo(progress, 2);
      const frame = await page.locator('#reconocimientos').evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          height: rect.height,
          titleTop: el.querySelector('.awards-title')!.getBoundingClientRect()
            .top,
          top: rect.top,
        };
      });
      expect(frame.top).toBeLessThanOrEqual(1);
      expect(frame.bottom).toBeGreaterThanOrEqual(viewport.height - 1);
      frames.push(frame);
    }
    expect(
      Math.max(...frames.map((f) => f.height)) -
        Math.min(...frames.map((f) => f.height)),
    ).toBeLessThan(1);
    expect(
      Math.max(...frames.map((f) => f.titleTop)) -
        Math.min(...frames.map((f) => f.titleTop)),
    ).toBeLessThan(1);
    await page.screenshot({
      path: `output/playwright/recognition-framed-${viewport.width}.png`,
    });
  });
}

test('favicon rises, zooms into contact and reverses with the scroll', async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto('/');
  await expect(page.locator('#jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  const shell = page.locator('.contact-reveal-shell');
  await expect(shell).toHaveClass(/contact-portal/);
  const seek = async (progress: number) => {
    await shell.evaluate((el, value) => {
      scrollTo({
        behavior: 'instant',
        top:
          scrollY +
          el.getBoundingClientRect().top +
          Number((el as HTMLElement).dataset['revealDistance']) * value,
      });
    }, progress);
    await expect
      .poll(
        () =>
          page
            .locator('#contacto')
            .evaluate((el) =>
              Number(
                (el as HTMLElement).style.getPropertyValue(
                  '--contact-progress',
                ),
              ),
            ),
        { timeout: 20000 },
      )
      .toBeCloseTo(progress, 2);
  };
  await seek(0.28);
  const mark = await page.locator('#contacto').evaluate((el) => ({
    ink: Number((el as HTMLElement).style.getPropertyValue('--portal-ink')),
    left: el.getBoundingClientRect().left,
    size: parseFloat(getComputedStyle(el).maskSize),
    y: Number(
      (el as HTMLElement).style
        .getPropertyValue('--portal-y')
        .replace('px', ''),
    ),
  }));
  expect(mark.ink).toBe(1);
  expect(mark.left).toBe(0);
  expect(Math.abs(mark.y)).toBeLessThan(1);
  await page.screenshot({ path: 'output/playwright/contact-portal-mark.png' });
  await seek(0.65);
  expect(
    await page
      .locator('#contacto')
      .evaluate((el) => parseFloat(getComputedStyle(el).maskSize)),
  ).toBeGreaterThan(mark.size * 2);
  await page.screenshot({ path: 'output/playwright/contact-portal-zoom.png' });
  await expect(page.locator('canvas.lanyard-canvas')).toHaveCSS(
    'visibility',
    'visible',
    { timeout: 20000 },
  );
  await expect(page.locator('canvas.lanyard-canvas')).toHaveCSS(
    'opacity',
    '1',
    { timeout: 20000 },
  );
  // Wheel/touch scrolling often settles a pixel backwards after moving down.
  await seek(0.648);
  await page.waitForTimeout(600);
  await expect(page.locator('canvas.lanyard-canvas')).toHaveCSS('opacity', '1');
  await seek(1);
  await expect(page.locator('#contacto')).toHaveCSS('mask-image', 'none');
  await expect(page.locator('#site-header')).toHaveClass(/contact-visible/);
  await expect(page.locator('canvas.lanyard-canvas')).toHaveCSS(
    'visibility',
    'visible',
    { timeout: 20000 },
  );
  await expect(page.locator('canvas.lanyard-canvas')).toHaveCSS(
    'opacity',
    '1',
    { timeout: 20000 },
  );
  await page.screenshot({
    path: 'output/playwright/contact-portal-complete.png',
  });
  await seek(0.9);
  await expect(page.locator('canvas.lanyard-canvas')).toHaveCSS(
    'visibility',
    'hidden',
  );
  await expect(page.locator('#site-header')).not.toHaveClass(/contact-visible/);
  await seek(0.28);
  await expect(page.locator('canvas.lanyard-canvas')).toHaveCSS(
    'transition-duration',
    '0.42s, 0.42s',
  );
  await expect(page.locator('canvas.lanyard-canvas')).toHaveCSS(
    'visibility',
    'hidden',
  );
  await expect(page.locator('#site-header')).not.toHaveClass(/contact-visible/);
});

test('mobile contact finishes the mask and allows reaching its footer', async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto('/');
  await expect(page.locator('#jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  await page.evaluate(() =>
    scrollTo({ behavior: 'instant', top: document.body.scrollHeight }),
  );
  await expect(page.locator('#contacto')).toHaveCSS('mask-image', 'none');
  await expect(page.locator('.site-footer')).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'output/playwright/contact-portal-mobile.png',
  });
});

test('reduced motion presents contact without a mask or scroll runway', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#contacto').scrollIntoViewIfNeeded();
  await expect(page.locator('#contacto')).toHaveCSS('mask-image', 'none');
  await expect(page.locator('.contact-portal-ink')).toBeHidden();
  const heights = await page
    .locator('.contact-reveal-shell')
    .evaluate((el) => [
      el.clientHeight,
      el.querySelector('#contacto')!.clientHeight,
    ]);
  expect(Math.abs(heights[0] - heights[1])).toBeLessThan(2);
});

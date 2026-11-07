import { expect, test } from '@playwright/test';

test('card completes its fall after slow scroll even if the reveal mask clips its observer', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ height: 700, width: 1100 });
  await page.addInitScript(() => {
    const NativeObserver = window.IntersectionObserver;
    // Model a clipped surface during the portal reveal. The canvas itself lives
    // in document.body and can already be visible outside that masked ancestor.
    window.IntersectionObserver = class extends NativeObserver {
      constructor(
        callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit,
      ) {
        super(
          (entries, observer) =>
            callback(
              entries.map((entry) =>
                entry.target.classList.contains('lanyard-surface')
                  ? new Proxy(entry, {
                      get(target, property) {
                        if (property === 'isIntersecting') return false;
                        if (property === 'intersectionRatio') return 0;
                        return Reflect.get(target, property, target);
                      },
                    })
                  : entry,
              ),
              observer,
            ),
          options,
        );
      }
    };
  });
  await page.goto('/');
  await expect(page.locator('#jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  await page.locator('.jm-privacy-close').click();
  const timeline = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.contact-reveal-shell')!;
    return {
      distance: Number(shell.dataset['revealDistance']),
      start: scrollY + shell.getBoundingClientRect().top,
    };
  });
  await page.evaluate(
    (top) => scrollTo({ behavior: 'instant', top }),
    timeline.start - 100,
  );
  await expect(page.locator('app-contact-lanyard')).toHaveAttribute(
    'data-renderer',
    'webgl',
    { timeout: 20000 },
  );
  for (let progress = 0.5; progress <= 0.71; progress += 0.05) {
    await page.evaluate(
      (top) => scrollTo({ behavior: 'instant', top }),
      timeline.start + timeline.distance * progress,
    );
    await page.waitForTimeout(100);
  }
  const canvas = page.locator('canvas.lanyard-canvas');
  await expect(canvas).toHaveCSS('visibility', 'visible');
  await expect
    .poll(
      () =>
        canvas.evaluate(
          (el) => new DOMMatrix(getComputedStyle(el).transform).m42,
        ),
      { timeout: 5000 },
    )
    .toBeCloseTo(0, 1);
  await expect(page.locator('.contact-lanyard-hit')).toHaveCSS(
    'pointer-events',
    'auto',
  );
});

test('card drops in during the favicon zoom', async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto('/');
  await expect(page.locator('#jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  await page.evaluate(() => {
    const shell = document.querySelector('.contact-reveal-shell')!;
    scrollTo({
      behavior: 'instant',
      top: scrollY + shell.getBoundingClientRect().top - 100,
    });
  });
  const canvas = page.locator('canvas.lanyard-canvas');
  await expect(page.locator('app-contact-lanyard')).toHaveAttribute(
    'data-renderer',
    'webgl',
    { timeout: 20000 },
  );
  const entrance = await canvas.evaluate(
    (el) =>
      new Promise<{ opacity: number; y: number; sectionLeft: number }>(
        (resolve) => {
          const observer = new MutationObserver(() => {
            if (getComputedStyle(el).visibility !== 'visible') return;
            observer.disconnect();
            resolve({
              opacity: Number(getComputedStyle(el).opacity),
              sectionLeft: document
                .querySelector('#contacto')!
                .getBoundingClientRect().left,
              y: new DOMMatrix(getComputedStyle(el).transform).m42,
            });
          });
          observer.observe(el, {
            attributeFilter: ['style'],
            attributes: true,
          });
          const shell = document.querySelector('.contact-reveal-shell')!;
          scrollTo({
            behavior: 'instant',
            top:
              scrollY +
              shell.getBoundingClientRect().top +
              Number((shell as HTMLElement).dataset['revealDistance']) * 0.65,
          });
        },
      ),
  );
  expect(entrance.sectionLeft).toBe(0);
  expect(entrance.opacity).toBeLessThan(1);
  expect(entrance.y).toBeLessThan(0);
  await expect(canvas).toHaveCSS('opacity', '1', { timeout: 20000 });
  await expect(canvas).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
});

test('contact replaces the final character with an interactive branded lanyard', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto('/');
  await expect(page.locator('#jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  await expect(page.locator('#hero-character')).toHaveCount(1);
  await page.evaluate(() =>
    scrollTo({ behavior: 'instant', top: document.body.scrollHeight }),
  );
  const lanyard = page.locator('app-contact-lanyard');
  await expect(lanyard).toBeVisible();
  await expect(page.locator('#contacto')).not.toHaveCSS(
    'background-image',
    /6ee57|a19eba/,
  );
  await expect(lanyard).toHaveAttribute('data-renderer', 'webgl', {
    timeout: 20000,
  });
  const canvas = page.locator('canvas.lanyard-canvas');
  await expect(canvas).toBeVisible();
  expect(await canvas.boundingBox()).toEqual({
    height: 900,
    width: 1440,
    x: 0,
    y: 0,
  });
  await expect
    .poll(
      async () => {
        const center = await page
          .locator('.contact-lanyard-hit')
          .evaluate((el) => {
            const c = el.style.clipPath.match(/-?[\d.]+/g)!.map(Number);
            return {
              x: (c[0] + c[2] + c[4] + c[6]) / 4,
              y: (c[1] + c[3] + c[5] + c[7]) / 4,
            };
          });
        await page.mouse.move(center.x, center.y);
        await page.mouse.down();
        const cursor = await canvas.evaluate(
          (el) => getComputedStyle(el).cursor,
        );
        if (cursor !== 'grabbing') await page.mouse.up();
        return cursor;
      },
      { timeout: 8000 },
    )
    .toBe('grabbing');
  await page.mouse.move(1280, 650, { steps: 6 });
  await expect(canvas).toHaveCSS('cursor', 'grabbing');
  await expect
    .poll(() =>
      page.locator('.contact-lanyard-hit').evaluate((el) => {
        const coordinates = el.style.clipPath.match(/-?[\d.]+/g)!.map(Number);
        return (
          (coordinates[0] + coordinates[2] + coordinates[4] + coordinates[6]) /
          4
        );
      }),
    )
    .toBeGreaterThan(1000);
  await page.screenshot({
    path: 'output/playwright/contact-lanyard-fullscreen-drag.png',
  });
  await page.mouse.up();
  await expect(
    page.getByRole('link', { name: 'Hablemos de tu proyecto por WhatsApp' }),
  ).toBeVisible();
  // Keep the visible scroll-driven portal in place while testing keyboard flips.
  await lanyard.evaluate((element) =>
    (element as HTMLElement).focus({ preventScroll: true }),
  );
  await page.keyboard.press('Enter');
  await expect(lanyard).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Enter');
  await expect(lanyard).toHaveAttribute('aria-pressed', 'false');
  await lanyard.evaluate((element) => (element as HTMLElement).blur());
  await page.screenshot({
    path: 'output/playwright/contact-lanyard-desktop.png',
  });
  await page.setViewportSize({ height: 844, width: 390 });
  await page.evaluate(() => {
    const section = document.querySelector('#contacto')!;
    scrollTo({
      behavior: 'instant',
      top: scrollY + section.getBoundingClientRect().top,
    });
  });
  await expect
    .poll(() =>
      page
        .locator('#contacto')
        .evaluate((el) => Math.abs(el.getBoundingClientRect().left)),
    )
    .toBeLessThan(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'output/playwright/contact-lanyard-mobile.png',
  });
});

test('reduced motion keeps a branded card that can flip without WebGL', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto('/');
  const lanyard = page.locator('app-contact-lanyard');
  await lanyard.scrollIntoViewIfNeeded();
  await expect(lanyard).toHaveAttribute('data-renderer', 'static');
  await expect(page.locator('canvas.lanyard-canvas')).toHaveCount(0);
  await lanyard.focus();
  await page.keyboard.press('Enter');
  await expect(lanyard.locator('.lanyard-fallback img')).toHaveAttribute(
    'src',
    '/static/media/contact-card-back.svg',
  );
});

import { expect, test, type Page } from '@playwright/test';

import type { PublicPortfolio } from '../../interfaces/portfolio.interface';

const titles = [
  'Tuna Podcast',
  'La Tomatera',
  'Postales patrimoniales',
  'Eco Bike Park',
  'Identidad de una marca con un nombre bastante largo',
  'Campaña cultural',
  'Séptimo trabajo',
  'Último trabajo del admin',
];
const content: PublicPortfolio = {
  media: [],
  projects: titles.map((title, index) => ({
    description: `Detalle del trabajo ${index + 1}`,
    id: `project_${index + 1}`,
    order: index,
    serviceId: 'brand',
    title,
  })),
  services: [
    {
      id: 'brand',
      slug: 'marca',
      subtitle: 'Este subtítulo no debe aparecer',
      title: 'Identidad visual',
    },
    { id: 'empty', slug: 'vacio', title: 'Edición audiovisual' },
  ],
};

async function openServices(page: Page) {
  await page.addInitScript((data) => {
    window.jmPortfolioData = data;
  }, content);
  await page.goto('/');
  await expect(page.locator('#jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  await page.locator('#menu-toggle').click();
  await page.locator('#navigation a[href="#servicios"]').click();
  await expect(page.locator('.service-panel').first()).toHaveJSProperty(
    'inert',
    false,
  );
  await expect(page.locator('.folder-float__trigger').first()).toBeInViewport({
    ratio: 0.99,
  });
}

test('visible part of an entering folder opens before the panel is fully aligned', async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.addInitScript((data) => {
    window.jmPortfolioData = data;
  }, content);
  await page.goto('/');
  await expect(page.locator('#jm-preloader')).toHaveCount(0, {
    timeout: 15000,
  });
  await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>('#inicio')!;
    const distance = innerHeight * 5.7;
    const total = hero.offsetHeight - innerHeight - distance;
    const intro = Math.min(innerHeight * 0.27, total * 0.12);
    const reveal = Math.min(innerHeight * 0.87, total * 0.22);
    scrollTo({
      behavior: 'instant',
      top: hero.offsetTop + distance + intro + reveal * 0.5,
    });
  });
  await expect
    .poll(() =>
      page
        .locator('.works-window')
        .evaluate((el) => Math.abs(el.getBoundingClientRect().left - 720)),
    )
    .toBeLessThan(4);
  const panel = page.locator('.service-panel').first();
  const folder = panel.locator('app-service-folder');
  const trigger = (await folder
    .locator('.folder-float__trigger')
    .boundingBox())!;
  await page.mouse.move(
    Math.min(1420, trigger.x + 35),
    trigger.y + trigger.height / 2,
  );
  await expect(folder).toHaveAttribute('data-open', '');
  await expect(panel).toHaveJSProperty('inert', false);
  await folder.evaluate(async (element) => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .filter(
          (animation) => animation.effect?.getTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
  await page.screenshot({
    path: 'output/playwright/services-folder-partial-entry.png',
  });
  const project = folder.locator('.folder-float__item').first();
  const bounds = (await project.boundingBox())!;
  expect(bounds.x + bounds.width / 2).toBeLessThan(1440);
  await page.mouse.click(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await expect(page.locator('#service-dialog')).toBeVisible();
  await expect(page.locator('#detail-title')).toHaveText('Tuna Podcast');
});

test('desktop folder floats, drags and opens projects from every page', async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await openServices(page);
  const panel = page.locator('.service-panel').first();
  const folder = panel.locator('app-service-folder');
  await expect(panel.locator('h3')).toHaveText('Identidad visual');
  await expect(
    panel.locator(
      '.panel-number, header p, .sample-button, .service-list, img, video',
    ),
  ).toHaveCount(0);
  await folder.hover();
  await expect(folder).toHaveAttribute('data-open', '');
  await expect(folder.locator('.folder-float__item')).toHaveCount(6);
  await expect(folder).toHaveAttribute('data-live', '', { timeout: 5000 });
  const pill = folder.locator('.folder-float__item').first();
  const box = (await pill.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 35,
    box.y + box.height / 2 - 15,
    { steps: 8 },
  );
  await expect(pill).toHaveAttribute('data-drag', '');
  await page.mouse.up();
  await expect(page.locator('#service-dialog')).not.toBeVisible();
  await page.screenshot({
    path: 'output/playwright/services-folder-desktop.png',
  });
  await folder.getByRole('button', { name: 'Siguientes trabajos' }).click();
  await expect(folder.locator('.folder-float__item')).toHaveCount(2);
  await expect(folder.locator('.folder-float__item').first()).toBeFocused();
  const last = folder.getByRole('button', {
    name: 'Ver proyecto: Último trabajo del admin',
  });
  await last.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#service-dialog')).toBeVisible();
  await expect(page.locator('#detail-title')).toHaveText(
    'Último trabajo del admin',
  );
  await expect(page.locator('#detail-description')).toHaveText(
    'Detalle del trabajo 8',
  );
  await expect(folder).not.toHaveAttribute('data-open');
  await page.keyboard.press('Escape');
  await expect(page.locator('#service-dialog')).not.toBeVisible();
  await expect(folder.locator('.folder-float__trigger')).toBeFocused();
});

test('folder supports keyboard navigation without moving the service carousel', async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await openServices(page);
  const folder = page.locator('app-service-folder').first();
  const trigger = folder.locator('.folder-float__trigger');
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(folder.locator('.folder-float__item').first()).toBeFocused();
  const before = await page
    .locator('#works-track')
    .evaluate((el) => el.getBoundingClientRect().left);
  await page.keyboard.press('ArrowRight');
  await expect(folder.locator('.folder-float__item').nth(1)).toBeFocused();
  expect(
    await page
      .locator('#works-track')
      .evaluate((el) => el.getBoundingClientRect().left),
  ).toBeCloseTo(before, 0);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test.describe('touch folders', () => {
  test.use({ hasTouch: true, isMobile: true });
  test('opens a project when lifting the finger does not leave keyboard focus', async ({
    page,
  }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.addInitScript(() => {
      // Safari/iOS does not consistently focus buttons tapped with a finger.
      document.addEventListener(
        'mousedown',
        (event) => {
          if ((event.target as Element).closest('.folder-float'))
            event.preventDefault();
        },
        true,
      );
    });
    await openServices(page);
    const folder = page.locator('app-service-folder').first();
    await folder.locator('.folder-float__trigger').tap();
    await folder.evaluate((element) => {
      (document.activeElement as HTMLElement)?.blur();
      element.dispatchEvent(
        new PointerEvent('pointerleave', { pointerType: 'touch' }),
      );
    });
    await expect(folder).toHaveAttribute('data-open', '');
    await folder.evaluate(async (element) => {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      await Promise.all(
        element
          .getAnimations({ subtree: true })
          .filter(
            (animation) =>
              animation.effect?.getTiming().iterations !== Infinity,
          )
          .map((animation) => animation.finished.catch(() => {})),
      );
    });
    const first = (await folder
      .locator('.folder-float__item')
      .first()
      .boundingBox())!;
    await page.touchscreen.tap(
      first.x + first.width / 2,
      first.y + first.height / 2,
    );
    await expect(page.locator('#service-dialog')).toBeVisible();
    await expect(page.locator('#detail-title')).toHaveText('Tuna Podcast');
    await page.locator('#service-dialog .dialog-close').tap();
    await expect(page.locator('#service-dialog')).not.toBeVisible();
    await folder.locator('.folder-float__trigger').tap();
    await expect(folder).toHaveAttribute('data-open', '');
    await folder.evaluate(async (element) => {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      await Promise.all(
        element
          .getAnimations({ subtree: true })
          .filter(
            (animation) =>
              animation.effect?.getTiming().iterations !== Infinity,
          )
          .map((animation) => animation.finished.catch(() => {})),
      );
    });
    const second = (await folder
      .locator('.folder-float__item')
      .nth(1)
      .boundingBox())!;
    await page.touchscreen.tap(
      second.x + second.width / 2,
      second.y + second.height / 2,
    );
    await expect(page.locator('#detail-title')).toHaveText('La Tomatera');
    await expect(page.locator('#service-dialog')).toBeVisible();
  });

  for (const width of [320, 390]) {
    test(`fits all six labels and opens a project at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ height: width === 320 ? 568 : 844, width });
      await openServices(page);
      const folder = page.locator('app-service-folder').first();
      await folder.locator('.folder-float__trigger').tap();
      await expect(folder).toHaveAttribute('data-open', '');
      await expect(folder).not.toHaveAttribute('data-live');
      const pills = folder.locator('.folder-float__item');
      await expect(pills).toHaveCount(6);
      await expect
        .poll(() => pills.last().evaluate((el) => getComputedStyle(el).opacity))
        .toBe('1');
      const bounds = await pills.evaluateAll((elements) =>
        elements.map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            top: rect.top,
          };
        }),
      );
      const heading = (await page
        .locator('.service-panel')
        .first()
        .locator('header')
        .boundingBox())!;
      for (const box of bounds) {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(width);
        expect(box.top).toBeGreaterThanOrEqual(0);
        expect(box.top).toBeGreaterThanOrEqual(heading.y + heading.height + 8);
        expect(box.bottom).toBeLessThanOrEqual(width === 320 ? 568 : 844);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `output/playwright/services-folder-mobile-${width}.png`,
      });
      await pills.first().tap();
      await expect(page.locator('#detail-title')).toHaveText('Tuna Podcast');
      await expect(page.locator('#service-dialog')).toBeVisible();
    });
  }
});

test('reduced motion keeps usable folders and an empty admin service', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.addInitScript((data) => {
    window.jmPortfolioData = data;
  }, content);
  await page.goto('/');
  const folder = page.locator('app-service-folder').first();
  await folder.scrollIntoViewIfNeeded();
  await folder.locator('.folder-float__trigger').focus();
  await page.keyboard.press('ArrowDown');
  await expect(folder).toHaveAttribute('data-open', '');
  await expect(folder).not.toHaveAttribute('data-live');
  await expect(folder.locator('.folder-float__item').first()).toHaveCSS(
    'transition-duration',
    '0s',
  );
  await expect(
    page.locator('app-service-folder').nth(1).locator('.folder-float__trigger'),
  ).toBeDisabled();
});

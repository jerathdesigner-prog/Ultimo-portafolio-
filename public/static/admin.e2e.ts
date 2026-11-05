import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('admin supports project editing, metrics, keyboard dismissal and mobile layout', async ({
  page,
}) => {
  const state = {
    services: [
      {
        id: 'srv_test',
        title: 'Diseño gráfico',
        subtitle: 'Identidades visuales',
        order: 0,
        published: true,
      },
    ],
    projects: [
      {
        id: 'prj_test',
        title: 'Identidad de marca',
        description: '',
        serviceId: 'srv_test',
        order: 0,
        published: true,
        media: [],
      },
    ],
    media: [],
  };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('http://localhost:8787/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/session')
      return route.fulfill({ json: { authenticated: true } });
    if (url.pathname === '/api/admin/state')
      return route.fulfill({ json: state });
    if (url.pathname === '/api/admin/analytics')
      return route.fulfill({
        json: {
          days: 7,
          start: '2026-11-01',
          end: '2026-11-07',
          totals: {
            views: 42,
            visitors: 30,
            sessions: 32,
            projects: 8,
            contacts: 4,
            conversion: 12.5,
          },
          previous: { views: 20 },
          daily: Array.from({ length: 30 }, (_, i) => ({
            day: '2026-10-' + String(i + 1).padStart(2, '0'),
            views: [2, 1, 0, 2, 3, 0, 1, 0, 4, 1][i % 10],
            visitors: 1,
          })),
          sources: [{ label: 'google.com', count: 42 }],
          devices: [{ label: 'Móvil', count: 42 }],
          countries: [{ label: 'EC', count: 42 }],
          projects: [{ label: 'prj_test', count: 8 }],
        },
      });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    if (url.pathname === '/favicon-jm-original.png') return route.fulfill({
      contentType: 'image/png',
      body: await readFile(resolve('public/favicon-jm-original.png')),
    });
    const file =
      url.pathname === '/admin'
        ? 'admin.html'
        : url.pathname.replace('/static/', '');
    const contentType = file?.endsWith('.css')
      ? 'text/css'
      : file?.endsWith('.js')
        ? 'text/javascript'
        : 'text/html';
    return route.fulfill({
      body: await readFile(resolve('public/static', file!)),
      contentType,
    });
  });
  await page.goto('/admin');
  await expect(
    page.getByRole('heading', { name: 'Hola, Jerath.' }),
  ).toBeVisible();
  await page.screenshot({
    path: 'output/playwright/admin-overview.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Proyectos', exact: true }).click();
  await page.getByRole('button', { name: 'Editar Identidad de marca' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Nombre del proyecto')).toBeFocused();
  await page.getByRole('button', { name: 'Cerrar editor' }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(
    page.getByRole('button', { name: 'Guardar cambios' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Cerrar editor' }),
  ).toBeFocused();
  await page.getByLabel('Nombre del proyecto').focus();
  await page.screenshot({ path: 'output/playwright/admin-editor.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Editar Identidad de marca' }).click();
  await page.getByLabel('Nombre del proyecto').fill('Cambios pendientes');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Métricas', exact: true }).click();
  await expect(page.getByText('google.com', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Tu audiencia, en perspectiva' }),
  ).toBeVisible();
  await page.screenshot({
    path: 'output/playwright/admin-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#sidebar')).not.toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: 'output/playwright/admin-mobile.png' });
  await page.getByRole('button', { name: 'Mostrar menú' }).click();
  await page.getByRole('button', { name: 'Proyectos', exact: true }).click();
  await page.getByRole('button', { name: 'Editar Identidad de marca' }).click();
  await page.screenshot({ path: 'output/playwright/admin-editor-mobile.png' });
});

test('public tracker records project and contact clicks and respects no tracking', async ({
  page,
}) => {
  const events: { type: string; project: string; session: string }[] = [];
  await page.route('http://localhost:8787/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/analytics') {
      events.push(route.request().postDataJSON());
      return route.fulfill({ status: 204 });
    }
    if (path === '/static/analytics.js')
      return route.fulfill({
        contentType: 'text/javascript',
        body: await readFile(resolve('public/static/analytics.js')),
      });
    return route.fulfill({
      contentType: 'text/html',
      body: '<button data-service="prj_test">Ver proyecto</button><a href="mailto:test@example.com">Contacto</a><script src="/static/analytics.js"></script>',
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ver proyecto' }).click();
  await page.getByRole('link', { name: 'Contacto' }).click();
  await expect.poll(() => events.length).toBe(3);
  expect(events.map((e) => e.type)).toEqual([
    'page_view',
    'project_view',
    'contact_click',
  ]);
  expect(events[1].project).toBe('prj_test');
  expect(events[1].session).toBe(events[0].session);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'doNotTrack', { value: '1' }),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Ver proyecto' }).click();
  expect(events.length).toBe(3);
});

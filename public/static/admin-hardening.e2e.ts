import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function openAdmin(page: Page, empty = false) {
  await page.route('http://localhost:8787/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/session')
      return route.fulfill({ json: { authenticated: true } });
    if (path === '/api/admin/state')
      return route.fulfill({
        json: {
          services: empty
            ? []
            : [{ id: 's1', title: 'Diseño', published: true, order: 0 }],
          projects: empty
            ? []
            : [
                {
                  id: 'p1',
                  title: 'Marca',
                  serviceId: 's1',
                  media: [],
                  published: true,
                  order: 0,
                },
              ],
          media: [],
        },
      });
    if (path.startsWith('/api/')) return route.fulfill({ json: {} });
    const file =
      path === '/admin' ? 'public/static/admin.html' : 'public' + path;
    return route.fulfill({
      body: await readFile(resolve(file)),
      contentType: file.endsWith('.js')
        ? 'text/javascript'
        : file.endsWith('.css')
          ? 'text/css'
          : file.endsWith('.png')
            ? 'image/png'
            : 'text/html',
    });
  });
  await page.goto('/admin');
  await expect(
    page.getByRole('heading', { name: 'Hola, Jerath.' }),
  ).toBeVisible();
}

test('empty services and filtered projects explain how to continue', async ({
  page,
}) => {
  await openAdmin(page, true);
  await page.getByRole('button', { name: 'Servicios', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Aún no hay servicios' }),
  ).toBeVisible();
  await openAdmin(page);
  await page.getByRole('button', { name: 'Proyectos', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Buscar proyectos' })
    .fill('No existe');
  await expect(
    page.getByRole('heading', { name: 'No hay resultados' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(
    page.getByRole('button', { name: 'Editar Marca' }),
  ).toBeVisible();
});

test('mobile navigation keeps hidden controls out of keyboard navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAdmin(page);
  await expect(page.locator('#sidebar')).toHaveJSProperty('inert', true);
  await page.getByRole('link', { name: 'Saltar al contenido' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#mobileMenu')).toBeFocused();
  const menu = page.locator('#mobileMenu');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page.getByRole('button', { name: 'Resumen', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
});

test('upload preserves edits made while waiting and prevents premature save', async ({
  page,
}) => {
  await openAdmin(page);
  let finishUpload!: () => void;
  const pending = new Promise<void>((complete) => {
    finishUpload = complete;
  });
  await page.route('**/api/admin/upload', async (route) => {
    await pending;
    await route.fulfill({
      json: {
        id: 'm1',
        filename: 'cover.png',
        kind: 'image',
        url: '/favicon-jm-original.png',
        bytes: 12,
      },
    });
  });
  await page.getByRole('button', { name: 'Proyectos', exact: true }).click();
  await page.getByRole('button', { name: 'Editar Marca' }).click();
  const title = page.getByLabel('Nombre del proyecto');
  await page
    .getByRole('button', { name: 'Subir una portada nueva' })
    .click({ noWaitAfter: true });
  await page
    .locator('#hiddenFilePicker')
    .setInputFiles({
      name: 'cover.png',
      mimeType: 'image/png',
      buffer: Buffer.from('image'),
    });
  await title.fill('Texto escrito durante la subida');
  const save = page.getByRole('button', {
    name: /Guardar cambios|Subiendo archivos/,
  });
  await expect(save).toBeDisabled();
  finishUpload();
  await expect(title).toHaveValue('Texto escrito durante la subida');
  await expect(page.locator('#coverSelect')).toHaveValue('m1');
  await expect(
    page.getByRole('button', { name: 'Guardar cambios' }),
  ).toBeEnabled();
});

test('editor submits with Enter and keeps the draft after a server error', async ({
  page,
}) => {
  await openAdmin(page);
  await page.route('**/api/admin/projects/p1', (route) =>
    route.fulfill({
      status: 500,
      json: { detail: 'No se pudo guardar. Intenta de nuevo.' },
    }),
  );
  await page.getByRole('button', { name: 'Proyectos', exact: true }).click();
  await page.getByRole('button', { name: 'Editar Marca' }).click();
  await page.getByLabel('Nombre del proyecto').fill('Marca nueva');
  await page.getByLabel('Nombre del proyecto').press('Enter');
  await expect(page.getByRole('alert')).toContainText('No se pudo guardar');
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue(
    'Marca nueva',
  );
  await expect(
    page.getByRole('button', { name: 'Guardar cambios' }),
  ).toBeEnabled();
});

test('failed deletion and logout report errors without losing the current screen', async ({
  page,
}) => {
  await openAdmin(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/admin/projects/p1', (route) =>
    route.fulfill({ status: 500, json: { detail: 'No se pudo eliminar.' } }),
  );
  await page.route('**/api/logout', (route) =>
    route.fulfill({
      status: 500,
      json: { detail: 'No se pudo cerrar sesión.' },
    }),
  );
  await page.getByRole('button', { name: 'Proyectos', exact: true }).click();
  await page.getByRole('button', { name: 'Editar Marca' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Eliminar proyecto' }).click();
  await expect(
    page.getByText('No se pudo eliminar.', { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await page.getByRole('button', { name: 'Cerrar editor' }).click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(
    page.getByText('No se pudo cerrar sesión.', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('#dashboard')).toBeVisible();
});

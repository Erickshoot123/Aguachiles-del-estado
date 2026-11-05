import { expect, test } from '@playwright/test';

test('actualización a demanda: abrir no busca; buscar, descargar e instalar son acciones separadas', async ({
  page,
}) => {
  let phase = 'idle';
  const actions: Array<{ action: string; confirmed: boolean }> = [];
  let refuseInstall = true;
  const state = () => ({
    phase,
    installedVersion: '0.2.6',
    availableVersion: phase === 'idle' ? null : '0.2.7',
    bytes: 1048576,
    progress: 100,
    releaseNotes: 'Mejoras de impresión',
    message: '',
  });
  await page.route('**/api/updates/status', (route) => route.fulfill({ json: state() }));
  await page.route('**/api/updates/action', async (route) => {
    const input = route.request().postDataJSON();
    actions.push(input);
    if (input.action === 'install' && refuseInstall)
      return route.fulfill({
        status: 409,
        json: {
          code: 'CONFLICT',
          message: 'Cierra las cajas de esta sucursal antes de instalar la actualización.',
        },
      });
    phase =
      input.action === 'check' ? 'available' : input.action === 'download' ? 'ready' : 'installing';
    await route.fulfill({ json: state() });
  });
  await page.goto('/');
  await page.getByLabel('Usuario').fill('admin');
  await page.getByLabel('Contraseña').fill('ChangeMe123!');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await page.getByRole('link', { name: 'Actualizaciones', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Actualizaciones', exact: true })).toBeVisible();
  await expect(page.getByText('0.2.6', { exact: true })).toBeVisible();
  expect(actions).toEqual([]);
  await page.getByRole('button', { name: 'Buscar actualizaciones', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Versión 0.2.7', exact: true })).toBeVisible();
  expect(actions.map((item) => item.action)).toEqual(['check']);
  await expect(
    page.getByRole('button', { name: 'Instalar y reiniciar POS', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Descargar versión', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Instalar y reiniciar POS', exact: true }),
  ).toBeEnabled();
  expect(actions.map((item) => item.action)).toEqual(['check', 'download']);
  await page.getByRole('button', { name: 'Instalar y reiniciar POS', exact: true }).click();
  await page.getByRole('button', { name: 'Ahora no', exact: true }).click();
  expect(actions).toHaveLength(2);
  await page.getByRole('button', { name: 'Instalar y reiniciar POS', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar instalación', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Cierra las cajas');
  refuseInstall = false;
  await page.getByRole('button', { name: 'Confirmar instalación', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByText('Preparando respaldo e instalación.', { exact: false }),
  ).toBeVisible();
  expect(actions.at(-1)).toMatchObject({ action: 'install', confirmed: true });
});

test('un canal sin configurar muestra el motivo y no consulta GitHub ni descarga', async ({
  page,
}) => {
  let changes = 0;
  await page.route('**/api/updates/status', (route) =>
    route.fulfill({
      json: {
        phase: 'unconfigured',
        installedVersion: '0.2.6-preview-20261104',
        message: 'El canal de actualizaciones todavía no está configurado en esta instalación.',
      },
    }),
  );
  page.on('request', (request) => {
    if (request.url().endsWith('/api/updates/action')) changes++;
  });
  await page.goto('/');
  await page.getByLabel('Usuario').fill('admin');
  await page.getByLabel('Contraseña').fill('ChangeMe123!');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await page.getByRole('link', { name: 'Actualizaciones', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Buscar actualizaciones', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('no está configurado');
  expect(changes).toBe(0);
  await page.screenshot({
    path: test.info().outputPath('actualizaciones-manuales.png'),
    fullPage: true,
  });
});

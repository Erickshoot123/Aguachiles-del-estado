import { expect, test } from '@playwright/test';

test('el navegador puede guardar en el agente real sin imprimir (incluye preflight CORS)', async ({
  page,
}) => {
  await page.goto('/login');
  const status = await page.evaluate(async () => {
    const response = await fetch('http://127.0.0.1:4100/printer-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printerId: 'configured', qrMode: 'raster' }),
    });
    return response.status;
  });
  expect(status).toBe(200);
});

test('apartado de impresoras: actualizar, guardar USB/BT y red; prueba solo al pulsar el botón', async ({
  page,
}) => {
  let selected = 'configured';
  let qrMode = 'raster';
  let printCount = 0;
  let saves = 0;
  const printers = [
    {
      id: 'configured',
      name: 'Archivo de prueba',
      kind: 'file',
      port: null,
      driver: null,
      offline: null,
    },
    {
      id: 'windows:fakeusb',
      name: 'Ofichido USB',
      kind: 'windows',
      port: 'USB002',
      driver: 'Generic / Text Only',
      offline: false,
    },
    {
      id: 'windows:fakebt',
      name: 'Ofichido Bluetooth',
      kind: 'windows',
      port: 'COM5',
      driver: 'Generic / Text Only',
      offline: false,
    },
  ];
  let network: { host: string; port: number } | undefined;
  await page.route('**/printer-settings', async (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON();
      selected = body.printerId;
      qrMode = body.qrMode;
      network = body.network;
      saves++;
      return route.fulfill({ json: { status: 'saved' } });
    }
    await route.fulfill({
      json: {
        printerId: selected,
        qrMode,
        network,
        activePrinterId: 'default',
        activeName:
          printers.find((printer) => printer.id === selected)?.name ??
          `Red ${network?.host}:${network?.port}`,
        printers,
        warning: null,
      },
    });
  });
  await page.route('http://127.0.0.1:4100/print', async (route) => {
    printCount++;
    const body = route.request().postDataJSON();
    expect(body.ticket.ticketNumber).toBe('PRUEBA DE IMPRESION');
    expect(body.ticket.format).toBe('thermal_58');
    expect(body.printerId).toBe('default');
    await route.fulfill({ json: { status: 'printed' } });
  });
  await page.goto('/');
  await page.getByLabel('Usuario').fill('admin');
  await page.getByLabel('Contraseña').fill('ChangeMe123!');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.getByRole('link', { name: 'Impresoras', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Impresoras', exact: true })).toBeVisible();
  await expect(page.locator('p').filter({ hasText: 'Ofichido Bluetooth' })).toContainText('COM5');
  await page.getByRole('button', { name: 'Actualizar lista', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Actualizar lista', exact: true })).toBeEnabled();
  expect(printCount).toBe(0);
  await page.getByLabel('Impresora del POS').selectOption('windows:fakeusb');
  await page.getByLabel('Papel', { exact: true }).selectOption('thermal_58');
  await page.getByRole('button', { name: 'Guardar impresora', exact: true }).click();
  await expect(page.getByText('Guardada: Ofichido USB', { exact: true })).toBeVisible();
  expect(printCount).toBe(0);
  await page.getByRole('button', { name: 'Imprimir prueba', exact: true }).click();
  await expect(page.getByText('Prueba enviada.', { exact: false })).toBeVisible();
  expect(printCount).toBe(1);
  await page.reload();
  await expect(page.getByLabel('Impresora del POS')).toHaveValue('windows:fakeusb');
  await page.getByLabel('Impresora del POS').selectOption('windows:fakebt');
  await page.getByRole('button', { name: 'Guardar impresora', exact: true }).click();
  await expect(page.getByText('Guardada: Ofichido Bluetooth', { exact: true })).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath('apartado-impresoras.png'),
    fullPage: true,
  });
  await page.getByLabel('Impresora del POS').selectOption('network');
  await page.getByLabel('IP o nombre de red').fill('192.168.1.50');
  await page.getByLabel('Puerto', { exact: true }).fill('9100');
  await page.getByRole('button', { name: 'Guardar impresora', exact: true }).click();
  await expect(page.getByText('Guardada: Red 192.168.1.50:9100', { exact: true })).toBeVisible();
  expect(saves).toBe(3);
  expect(printCount).toBe(1);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/$/);
});

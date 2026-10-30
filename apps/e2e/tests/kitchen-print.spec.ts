import { expect, test } from '@playwright/test';
import { ensurePlateAvailability } from './plateSetup';

test('fallar la impresión conserva el pedido y permite reimprimir sin duplicarlo', async ({ page }) => {
  let creates = 0;
  let prints = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/orders') creates += 1;
  });
  await page.route('http://127.0.0.1:4100/print', async (route) => {
    prints += 1;
    if (prints === 1) await route.fulfill({ status: 502, contentType: 'application/json',
      body: JSON.stringify({ code: 'PRINT_FAILED', message: 'Impresora apagada' }) });
    else await route.continue();
  });
  await page.goto('/');
  await page.getByLabel('Usuario').fill('cajero');
  await page.getByLabel('Contraseña').fill('ChangeMe123!');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await ensurePlateAvailability(page);
  await page.getByRole('button', { name: 'Nuevo pedido' }).click();
  const dialog = page.getByRole('dialog').last();
  await dialog.getByRole('button', { name: 'Mostrador', exact: true }).click();
  await dialog.getByRole('button', { name: 'Agregar uno: Aguachile Tradicional (medio kilo)', exact: true }).click();
  await dialog.getByRole('button', { name: 'Crear pedido', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(/Impresión sin confirmar/)).toBeVisible();
  expect(creates).toBe(1);
  expect(prints).toBe(1);
  // La tarea sobrevive recargar, pero no se reenvía sola para evitar duplicados físicos.
  await page.reload();
  await expect(page.getByText(/Impresión sin confirmar/)).toBeVisible();
  expect(prints).toBe(1);
  await page.getByRole('button', { name: 'Reimprimir comanda' }).click();
  await expect(page.getByRole('button', { name: 'Reimprimir comanda' })).toHaveCount(0);
  expect(creates).toBe(1);
  expect(prints).toBe(2);
});

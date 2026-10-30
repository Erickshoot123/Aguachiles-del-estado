import { expect, test } from '@playwright/test';
import type { PlateAvailability } from '@aguachiles/shared';
import { ensurePlateAvailability } from './plateSetup';

test('ajustar producción habilita platos agotados y limita las cantidades por presentación', async ({ page, request }) => {
  const login = await request.post('http://127.0.0.1:3100/api/auth/login', {
    data: { username: 'admin', password: 'ChangeMe123!' },
  });
  const { accessToken } = await login.json() as { accessToken: string };
  await page.goto('/');
  await page.getByLabel('Usuario').fill('admin');
  await page.getByLabel('Contraseña').fill('ChangeMe123!');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await ensurePlateAvailability(page);
  const response = await request.get('http://127.0.0.1:3100/api/plates/today', { headers: { Authorization: `Bearer ${accessToken}` } });
  const stock = await response.json() as PlateAvailability;
  const remaining = stock.buckets.find((bucket) => bucket.size === 'half_kilo')!.available;
  if (remaining > 0) {
    await page.getByRole('button', { name: 'Ajustar platos', exact: true }).click();
    await page.getByLabel('Agregar/quitar platos de 1/2 kilo', { exact: true }).fill(String(-remaining));
    await page.getByLabel('Motivo del ajuste').fill('Merma de prueba');
    await page.getByRole('button', { name: 'Guardar ajuste' }).click();
  }
  await expect(page.getByText('1/2 kilo: 0 disponibles', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo pedido' }).click();
  let dialog = page.getByRole('dialog').last();
  await expect(dialog.getByRole('button', { name: 'Agregar uno: Aguachile Tradicional (medio kilo)', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Agregar uno: Aguachile Tradicional (1 kilo)', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Ajustar platos', exact: true }).click();
  await page.getByLabel('Agregar/quitar platos de 1/2 kilo', { exact: true }).fill('2');
  await page.getByLabel('Motivo del ajuste').fill('Compra adicional');
  await page.getByRole('button', { name: 'Guardar ajuste' }).click();
  await expect(page.getByText('1/2 kilo: 2 disponibles', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo pedido' }).click();
  dialog = page.getByRole('dialog').last();
  await dialog.getByRole('button', { name: 'Mostrador', exact: true }).click();
  await dialog.getByRole('button', { name: 'Agregar uno: Aguachile Tradicional (medio kilo)', exact: true }).click();
  await dialog.getByRole('button', { name: 'Agregar uno: Aguachile Colorado (medio kilo)', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Agregar uno: Aguachile Prieto (medio kilo)', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Crear pedido', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('1/2 kilo: 0 disponibles', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/plate-availability.png', fullPage: true });
});

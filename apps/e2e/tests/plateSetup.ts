import { expect, type Page } from '@playwright/test';

export async function ensurePlateAvailability(page: Page): Promise<void> {
  const panel = page.getByRole('region', { name: 'Disponibilidad de platos' });
  await panel.getByRole('heading', { name: /Platos de hoy/ }).waitFor();
  // Espera la respuesta: el botón Nuevo pedido solo se habilita después de registrar la jornada.
  await expect(panel.getByText('Cargando disponibilidad…')).not.toBeVisible();
  if (await page.getByRole('button', { name: 'Registrar platos iniciales' }).isVisible()) {
    await page.getByLabel('Platos iniciales de 1 kilo', { exact: true }).fill('1000');
    await page.getByLabel('Platos iniciales de 1/2 kilo', { exact: true }).fill('1000');
    await page.getByRole('button', { name: 'Registrar platos iniciales' }).click();
  }
  await expect(page.getByRole('button', { name: 'Nuevo pedido' })).toBeEnabled();
}

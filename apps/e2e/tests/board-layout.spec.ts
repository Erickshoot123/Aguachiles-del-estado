import { expect, test } from '@playwright/test';
import { ensurePlateAvailability } from './plateSetup';

test('las tres columnas vacías llenan la altura disponible del tablero', async ({ page }) => {
  await page.route('**/api/orders', async (route) => {
    if (route.request().method() === 'GET') await route.fulfill({ json: [] });
    else await route.continue();
  });
  await page.goto('/');
  await page.getByLabel('Usuario').fill('admin');
  await page.getByLabel('Contraseña').fill('ChangeMe123!');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await ensurePlateAvailability(page);
  const columns = page.locator('main > section').last().locator(':scope > div');
  await expect(columns).toHaveCount(3);
  const viewportHeight = page.viewportSize()!.height;
  for (const column of await columns.all()) {
    const box = await column.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeGreaterThanOrEqual(viewportHeight - 16);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewportHeight);
  }
  await page.screenshot({ path: test.info().outputPath('columnas-altura-completa.png') });
});

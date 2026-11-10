import { expect, test } from '@playwright/test';

test('Nuevo producto guarda con los campos del menú y genera el SKU', async ({ page }) => {
  const category = `Bebidas de prueba ${Date.now()}`;
  await page.goto('/login');
  await page.getByLabel('Usuario', { exact: true }).fill('admin');
  await page.getByLabel('Contraseña', { exact: true }).fill('ChangeMe123!');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await page.getByRole('link', { name: 'Menú y productos', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo producto', exact: true }).click();
  const dialog = page.getByRole('dialog');
  for (const label of [
    'SKU',
    'Código de barras (opcional)',
    'Descripción (opcional)',
    'Impuesto (%)',
  ]) {
    await expect(dialog.getByLabel(label, { exact: true })).toHaveCount(0);
  }
  await dialog.getByLabel('Nombre', { exact: true }).fill('Agua fresca de prueba');
  await dialog.getByLabel('Nueva categoría', { exact: true }).fill(category);
  const categoryCreated = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/api/categories'),
  );
  await dialog.getByRole('button', { name: 'Agregar', exact: true }).click();
  const categoryResponse = await categoryCreated;
  expect(categoryResponse.status()).toBe(201);
  await expect(dialog.getByRole('combobox', { name: 'Categoría', exact: true })).toHaveValue(
    (await categoryResponse.json()).id,
  );
  await dialog.getByLabel('Precio de venta', { exact: true }).fill('24.50');
  await dialog.getByLabel('Unidad', { exact: true }).fill('vaso');
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/api/products'),
  );
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  const result = await saved;
  expect(result.status()).toBe(201);
  expect(await result.json()).toMatchObject({
    sku: expect.stringMatching(/^PRD-/),
    price: 24.5,
    unit: 'vaso',
    taxRate: 0,
  });
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('row').filter({ hasText: 'Agua fresca de prueba' })).toContainText(
    category,
  );
});

import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, username: string, password: string) {
  await page.getByLabel('Usuario', { exact: true }).fill(username);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
}

test('el administrador crea y desactiva una cuenta que cambia su contraseña inicial', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(60_000);
  const staff = await browser.newPage({ baseURL });
  const username = `caja-${Date.now()}`;
  try {
    await page.goto('/login');
    await login(page, 'admin', 'ChangeMe123!');
    await page.getByRole('link', { name: 'Usuarios', exact: true }).click();
    await page.getByRole('button', { name: 'Nuevo usuario' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nombre', { exact: true }).fill('Operador de prueba');
    await dialog.getByLabel('Usuario', { exact: true }).fill(username);
    await dialog.getByLabel('Contraseña inicial', { exact: true }).fill('Inicial-789');
    await dialog.getByLabel('Confirmar contraseña', { exact: true }).fill('diferente');
    await dialog.getByRole('button', { name: 'Crear usuario' }).click();
    await expect(dialog.getByText('Las contraseñas no coinciden.')).toBeVisible();
    await dialog.getByLabel(/Confirmar contraseña/).fill('Inicial-789');
    await dialog.getByRole('button', { name: 'Crear usuario' }).click();
    const row = page.getByRole('row').filter({ hasText: username });
    await expect(row).toContainText('cajero');

    await staff.goto('/login');
    await login(staff, username, 'Inicial-789');
    await expect(
      staff.getByRole('heading', { name: 'Cambia tu contraseña inicial' }),
    ).toBeVisible();
    await staff.goto('/');
    await expect(
      staff.getByRole('heading', { name: 'Cambia tu contraseña inicial' }),
    ).toBeVisible();
    await staff.getByLabel('Contraseña inicial', { exact: true }).fill('Inicial-789');
    await staff.getByLabel('Nueva contraseña', { exact: true }).fill('Personal-456');
    await staff.getByLabel('Confirmar nueva contraseña', { exact: true }).fill('Personal-456');
    await staff.getByRole('button', { name: 'Guardar contraseña' }).click();
    await expect(
      staff.getByText('Contraseña actualizada. Inicia sesión con tu nueva contraseña.'),
    ).toBeVisible();
    await login(staff, username, 'Personal-456');
    await expect(staff.getByRole('heading', { name: 'Tablero de pedidos' })).toBeVisible();

    await row.getByRole('button', { name: 'Desactivar', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Desactivar cuenta' }).click();
    await expect(row.getByText('Inactivo', { exact: true })).toBeVisible();
    await staff.reload();
    await expect(staff.getByRole('button', { name: 'Ingresar', exact: true })).toBeVisible();
    await login(staff, username, 'Personal-456');
    await expect(staff.getByRole('alert')).toContainText('El usuario está desactivado');
  } finally {
    await staff.close();
  }
});

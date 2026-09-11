import { expect, test } from '@playwright/test';

const CAJERO_EMAIL = 'cajero@aguachiles.local';
const CAJERO_PASSWORD = 'ChangeMe123!';
const PRODUCT_NAME = 'Aguachile clásico';

test('flujo completo de cajero: login, abrir caja, vender con pago dividido, imprimir ticket, cerrar caja', async ({
  page,
}) => {
  await test.step('login', async () => {
    await page.goto('/');
    await page.getByLabel('Correo electrónico').fill(CAJERO_EMAIL);
    await page.getByLabel('Contraseña').fill(CAJERO_PASSWORD);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.getByRole('heading', { name: 'Tablero de pedidos' })).toBeVisible();
  });

  await test.step('abrir caja', async () => {
    await page.getByRole('link', { name: 'Caja y cierre' }).click();
    await page.getByLabel('Caja de esta terminal').selectOption({ label: 'Caja principal' });
    await page.getByLabel('Fondo inicial').fill('500');
    await page.getByRole('button', { name: 'Abrir caja', exact: true }).click();
    await expect(page.getByText('Caja abierta desde')).toBeVisible();
  });

  let ticketNumber = '';

  await test.step('crear pedido', async () => {
    await page.getByRole('link', { name: 'Pedidos' }).click();
    await page.getByRole('button', { name: 'Nuevo pedido' }).click();

    const dialog = page.getByRole('dialog').last();
    const productRow = dialog.getByText(PRODUCT_NAME, { exact: true }).locator('..');
    await productRow.getByRole('spinbutton').fill('1');
    await dialog.getByRole('button', { name: 'Crear pedido' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const lastCard = page.locator('article').last();
    ticketNumber = (await lastCard.locator('span').first().innerText()).trim();
    expect(ticketNumber).toMatch(/^#\d+$/);
  });

  await test.step('cobrar con pago dividido (efectivo + tarjeta)', async () => {
    await page.locator('article', { hasText: ticketNumber }).click();
    const detailDialog = page.getByRole('dialog').last();
    await detailDialog.getByRole('button', { name: 'Cobrar', exact: true }).click();

    const chargeDialog = page.getByRole('dialog').last();
    const firstAmount = chargeDialog.getByRole('spinbutton').first();
    const total = Number(await firstAmount.inputValue());
    const cashAmount = Math.floor(total / 2);
    const cardAmount = total - cashAmount;

    await firstAmount.fill(String(cashAmount));
    await chargeDialog.getByRole('button', { name: 'Agregar otro método' }).click();

    const secondLine = chargeDialog.locator('select').nth(1);
    await secondLine.selectOption({ label: 'Tarjeta' });
    await chargeDialog.getByRole('spinbutton').nth(1).fill(String(cardAmount));

    await expect(chargeDialog.getByText('Restante')).toBeVisible();

    await chargeDialog.getByRole('button', { name: 'Confirmar cobro' }).click();
    await expect(page.getByRole('dialog').last().getByRole('button', { name: 'Ticket', exact: true })).toBeVisible();
  });

  await test.step('imprimir ticket (Print Agent real, en modo archivo)', async () => {
    const detailDialog = page.getByRole('dialog').last();
    await detailDialog.getByRole('button', { name: 'Ticket', exact: true }).click();

    const ticketDialog = page.getByRole('dialog').last();
    await ticketDialog.getByRole('button', { name: 'Imprimir', exact: true }).click();
    await expect(ticketDialog.getByRole('button', { name: 'Reimprimir' })).toBeVisible();
    await ticketDialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  });

  await test.step('cerrar caja', async () => {
    // El modal de detalle sigue abierto; su fondo cubre toda la pantalla
    // (incluida la barra de navegación), así que hay que cerrarlo primero
    // haciendo clic fuera del contenido antes de poder navegar.
    await page.mouse.click(10, 10);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('link', { name: 'Caja y cierre' }).click();
    await page.getByLabel('Efectivo contado').fill('750');
    await page.getByRole('button', { name: 'Cerrar caja', exact: true }).click();
    await expect(page.getByText('Último cierre')).toBeVisible();
    await expect(page.getByText('Diferencia')).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { ensurePlateAvailability } from './plateSetup';

const CAJERO_USERNAME = 'cajero';
const CAJERO_PASSWORD = 'ChangeMe123!';
const PRODUCT_NAME = 'Aguachile Tradicional (medio kilo)';
const EXTRA_PRODUCT_NAME = 'Tostadas extra (5 pzas)';

test('flujo completo de cajero: login, abrir caja, vender con pago dividido, imprimir ticket, cerrar caja', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.print = () => {
      const root = document.documentElement;
      root.dataset.printDialogCalls = String(Number(root.dataset.printDialogCalls ?? 0) + 1);
    };
  });
  await test.step('login', async () => {
    await page.goto('/');
    await page.getByLabel('Usuario').fill(CAJERO_USERNAME);
    await page.getByLabel('Contraseña').fill(CAJERO_PASSWORD);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.getByRole('heading', { name: 'Tablero de pedidos' })).toBeVisible();
    await ensurePlateAvailability(page);
  });

  await test.step('abrir caja', async () => {
    await page.getByRole('link', { name: 'Caja y cierre' }).click();
    await page.getByLabel('Caja de esta terminal').selectOption({ label: 'Caja principal' });
    await page.getByLabel('Fondo inicial').fill('500');
    await page.getByRole('button', { name: 'Abrir caja', exact: true }).click();
    await expect(page.getByText('Caja abierta desde')).toBeVisible();
  });

  await test.step('consultar las pantallas de operación e impresoras', async () => {
    await page.getByRole('link', { name: 'Menú y productos', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Menú y productos' })).toBeVisible();
    await expect(page.getByText(PRODUCT_NAME, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuevo producto' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Proveedores y compras', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Proveedores y compras' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nueva compra' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Impresoras', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Impresoras', exact: true })).toBeVisible();
  });

  let ticketNumber = '';

  await test.step('crear pedido', async () => {
    await page.getByRole('link', { name: 'Pedidos' }).click();
    await page.getByRole('button', { name: 'Nuevo pedido' }).click();

    const dialog = page.getByRole('dialog').last();
    await expect(dialog.getByRole('button', { name: 'Delivery', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await dialog.getByRole('button', { name: 'Mostrador', exact: true }).click();
    await dialog.getByRole('button', { name: `Agregar uno: ${PRODUCT_NAME}`, exact: true }).click();

    // El aviso de "¿Quieres agregar algo extra?" solo aparece una vez que hay
    // al menos un producto principal con cantidad > 0.
    await dialog.getByRole('button', { name: `Agregar uno: ${EXTRA_PRODUCT_NAME}`, exact: true }).click();

    const created = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().endsWith('/api/orders'),
    );
    await dialog.getByRole('button', { name: 'Crear pedido' }).click();
    const createdOrder = await created;
    expect(createdOrder.ok()).toBeTruthy();
    ticketNumber = (await createdOrder.json()).ticketNumber;
    await expect(page.getByRole('dialog')).toHaveCount(0);

    expect(ticketNumber).toMatch(/^#\d+$/);
    const comanda = (await readFile('../print-agent/print-output/e2e-ticket.bin', 'latin1')).replace(/\s+/g, ' ');
    expect(comanda).toContain('COMANDA DE COCINA');
    expect(comanda).toContain(ticketNumber);
    expect(comanda).toContain(PRODUCT_NAME);
    expect(comanda).toContain(EXTRA_PRODUCT_NAME);
    expect(comanda).toContain('TOTAL $155.00');
  });

  await test.step('cobrar con pago dividido (efectivo + tarjeta)', async () => {
    await page.getByRole('article', { name: `Pedido ${ticketNumber}`, exact: true }).click();
    await page.getByRole('button', { name: 'Comanda en otra impresora…', exact: true }).click();
    await page.getByRole('button', { name: 'Elegir impresora…', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-print-dialog-calls', '1');
    const printable = page.locator('body > .pos-print-document');
    await expect(printable).toBeHidden();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#root')).toBeHidden();
    await expect(printable).toBeVisible();
    await expect(printable).toContainText('Comanda de cocina');
    await expect(printable).toContainText('Total$155.00');
    await page.emulateMedia({ media: null });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(1);

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
    await ticketDialog.getByRole('button', { name: 'Elegir impresora…', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-print-dialog-calls', '2');
    await expect(page.locator('body > .pos-print-document')).toContainText('Ticket de venta');
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

test('Gerente conserva Operación e Impresoras, y Usuarios y Actualizaciones son solo de Admin', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Usuario').fill('gerente');
  await page.getByLabel('Contraseña').fill(CAJERO_PASSWORD);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  for (const label of ['Pedidos', 'Menú y productos', 'Proveedores y compras', 'Impresoras']) {
    await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  for (const [label, path] of [['Usuarios', '/usuarios'], ['Actualizaciones', '/actualizaciones']] as const) {
    await expect(page.getByRole('link', { name: label, exact: true })).toHaveCount(0);
    await page.goto(path);
    await expect(page).toHaveURL('/');
  }
});

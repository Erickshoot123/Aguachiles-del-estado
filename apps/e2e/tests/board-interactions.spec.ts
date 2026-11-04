import { expect, test } from '@playwright/test';
import { ensurePlateAvailability } from './plateSetup';

test('nombre opcional, colores, arrastre persistente, reimpresión y ESC por capas', async ({ page }) => {
  test.setTimeout(60000);
  const tickets: Array<{ isReprint: boolean; customerName: string | null }> = [];
  let creates = 0;
  page.on('request', (req) => { if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/orders') creates += 1; });
  await page.route('http://127.0.0.1:4100/print', async (route) => {
    tickets.push(route.request().postDataJSON().ticket);
    await route.fulfill({ json: { status: 'printed' } });
  });
  await page.goto('/'); await page.getByLabel('Usuario').fill('admin'); await page.getByLabel('Contraseña').fill('ChangeMe123!');
  await page.getByRole('button', { name: 'Ingresar' }).click(); await ensurePlateAvailability(page);
  await page.getByRole('button', { name: 'Nuevo pedido', exact: true }).click();
  const dialog = page.getByRole('dialog').last();
  await expect(dialog.getByLabel('Nombre del cliente (opcional)')).toBeVisible();
  for (const [variant, color] of [['Tradicional', 'rgb(240, 253, 244)'], ['Colorado', 'rgb(254, 242, 242)'], ['Prieto', 'rgb(31, 41, 55)']] as const) {
    const button = dialog.getByRole('button', { name: `Agregar uno: Aguachile ${variant} (1 kilo)`, exact: true }).first();
    await expect(button.locator('..')).toHaveCSS('background-color', color);
  }
  await dialog.getByLabel('Teléfono').fill('6671234567'); await dialog.getByLabel('Dirección', { exact: true }).fill('Calle Prueba 456');
  await dialog.getByRole('button', { name: 'Agregar uno: Aguachile Tradicional (1 kilo)', exact: true }).first().click();
  await expect(dialog.getByText(/Porción|Sin pepino|Extra picante/)).toHaveCount(0);
  const created = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/orders');
  await dialog.getByRole('button', { name: 'Crear pedido', exact: true }).click();
  const order = await (await created).json(); expect(order.customerName).toBeNull();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const card = page.getByRole('article', { name: `Pedido ${order.ticketNumber}`, exact: true });
  for (const target of ['En espera de recolección', 'Enviado', 'Cocina']) {
    await expect(card).toHaveAttribute('draggable', 'true');
    await card.dragTo(page.getByRole('region', { name: target, exact: true }));
    await expect(page.getByRole('region', { name: target, exact: true }).getByRole('article', { name: `Pedido ${order.ticketNumber}`, exact: true })).toBeVisible();
  }
  await page.reload(); await expect(page.getByRole('region', { name: 'Cocina', exact: true }).getByRole('article', { name: `Pedido ${order.ticketNumber}`, exact: true })).toBeVisible();
  await card.click(); const detail = page.getByRole('dialog').last();
  await expect(detail.getByText('Calle Prueba 456', { exact: true })).toBeVisible();
  await detail.getByRole('button', { name: 'Reimprimir comanda', exact: true }).click();
  await expect(detail.getByText('Comanda enviada a la impresora.')).toBeVisible();
  expect(creates).toBe(1); expect(tickets).toHaveLength(2); expect(tickets[0]!.isReprint).toBe(false); expect(tickets[1]!.isReprint).toBe(true);
  await detail.getByRole('button', { name: 'WhatsApp', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(2);
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Nuevo pedido', exact: true }).click(); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'Reportes', exact: true }).click(); await expect(page).toHaveURL(/reportes/);
  await page.keyboard.press('Escape'); await expect(page).toHaveURL(/\/$/);
  await page.screenshot({ path: test.info().outputPath('tablero-actualizado.png') });
});

import { expect, test } from '@playwright/test';
import { ensurePlateAvailability } from './plateSetup';

test('fallar la impresión conserva el pedido y permite reimprimir sin duplicarlo', async ({ page }) => {
  let creates = 0;
  let prints = 0;
  let printedNotes = '';
  let savedNotes = '';
  let printedCustomer = '';
  let printedTotal = 0;
  page.on('response', async (response) => {
    if (response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/orders' && response.ok()) {
      savedNotes = (await response.json()).notes;
    }
  });
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/orders') creates += 1;
  });
  await page.route('http://127.0.0.1:4100/print', async (route) => {
    prints += 1;
    const ticket = route.request().postDataJSON().ticket;
    printedNotes = ticket.notes;
    printedCustomer = ticket.customerName;
    printedTotal = ticket.total;
    expect(ticket.customerPhone).toBe('6671234567');
    expect(ticket.deliveryAddress).toBe('Calle de prueba 123');
    expect(ticket.deliveryReferences).toBe('Casa azul');
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
  await dialog.getByRole('button', { name: 'Sin pepino', exact: true }).click();
  await dialog.getByRole('button', { name: 'Sin ajo', exact: true }).click();
  await dialog.getByRole('button', { name: 'Sin pimienta', exact: true }).click();
  await dialog.getByRole('button', { name: 'Sin ajo', exact: true }).click();
  await dialog.getByLabel('Notas del pedido (opcional)').fill('Salsa aparte');
  await dialog.getByRole('button', { name: 'Mostrador', exact: true }).click();
  await dialog.getByRole('button', { name: 'Delivery', exact: true }).click();
  await dialog.getByLabel('Nombre del cliente').fill('Ana Prueba');
  await dialog.getByLabel('Teléfono').fill('6671234567');
  await dialog.getByLabel('Dirección', { exact: true }).fill('Calle de prueba 123');
  await dialog.getByLabel('Referencias (opcional)').fill('Casa azul');
  await dialog.getByRole('button', { name: 'Agregar uno: Aguachile Tradicional (1 kilo)', exact: true }).click();
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
  expect(savedNotes).toBe('Sin pepino\nSin pimienta\nSalsa aparte');
  expect(printedNotes).toBe(savedNotes);
  expect(printedCustomer).toBe('Ana Prueba');
  expect(printedTotal).toBeGreaterThan(0);
});

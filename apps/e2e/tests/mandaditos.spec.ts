import { expect, test } from '@playwright/test';
import { ensurePlateAvailability } from './plateSetup';

test('mandaditos con teclado numérico y efectivo de caja, cierre y analítica de comida', async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  await page.route('http://127.0.0.1:4100/print', (route) =>
    route.fulfill({ json: { status: 'printed' } }),
  );
  await page.goto('/');
  await page.getByLabel('Usuario').fill('admin');
  await page.getByLabel('Contraseña').fill('ChangeMe123!');
  const loginResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/auth/login'),
  );
  await page.getByRole('button', { name: 'Ingresar' }).click();
  const token = (await (await loginResponse).json()).accessToken;
  const headers = { Authorization: `Bearer ${token}` };
  await ensurePlateAvailability(page);
  await page.getByRole('link', { name: 'Caja y cierre', exact: true }).click();
  await page.getByLabel('Caja de esta terminal').selectOption({ label: 'Caja principal' });
  await page.getByLabel('Fondo inicial').fill('500');
  await page.getByRole('button', { name: 'Abrir caja', exact: true }).click();
  await expect(page.getByText('Caja abierta desde')).toBeVisible();
  const registers = await (
    await request.get('http://127.0.0.1:3100/api/cash-registers', { headers })
  ).json();
  const register = registers.find((item: { name: string }) => item.name === 'Caja principal');
  const methods = await (
    await request.get('http://127.0.0.1:3100/api/payment-methods', { headers })
  ).json();
  const cash = methods.find((item: { type: string }) => item.type === 'cash');
  await page.getByRole('link', { name: 'Pedidos', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo pedido', exact: true }).click();
  const createDialog = page.getByRole('dialog').last();
  await expect(createDialog.getByText('Costo Envío / Mandadito')).toHaveCount(0);
  await createDialog.getByLabel('Teléfono').fill('6670000000');
  await createDialog.getByLabel('Dirección', { exact: true }).fill('Calle de prueba');
  await createDialog
    .getByRole('button', { name: 'Agregar uno: Aguachile Tradicional (1 kilo)', exact: true })
    .click();
  const created = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/api/orders'),
  );
  await createDialog.getByRole('button', { name: 'Crear pedido', exact: true }).click();
  const order = await (await created).json();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    (
      await request.patch(`http://127.0.0.1:3100/api/orders/${order.id}/charge`, {
        headers,
        data: {
          cashRegisterId: register.id,
          payments: [{ paymentMethodId: cash.id, amount: order.total }],
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.reload();
  await page.getByRole('article', { name: `Pedido ${order.ticketNumber}`, exact: true }).click();
  const detail = page.getByRole('dialog').first();
  for (const amount of ['50', '100']) {
    await detail.getByRole('button', { name: 'Agregar Envío / Mandadito', exact: true }).click();
    const modal = page.getByRole('dialog').last();
    await expect(modal.locator('input')).toHaveCount(2);
    await expect(modal.getByRole('combobox')).toHaveCount(0);
    await expect(modal.getByLabel('Folio del pedido (opcional)')).toHaveValue(order.ticketNumber);
    const keypad = modal.getByRole('group', { name: 'Teclado numérico del monto' });
    for (const digit of amount)
      await keypad.getByRole('button', { name: digit, exact: true }).click();
    if (amount === '50') {
      await keypad.getByRole('button', { name: 'Borrar último dígito', exact: true }).click();
      await expect(modal.getByLabel('Monto pagado al mandadito ($)')).toHaveValue('5');
      await keypad.getByRole('button', { name: '0', exact: true }).click();
      await keypad.getByRole('button', { name: 'Punto decimal', exact: true }).click();
      for (const digit of ['5', '0', '7'])
        await keypad.getByRole('button', { name: digit, exact: true }).click();
      await keypad.getByRole('button', { name: 'Punto decimal', exact: true }).click();
      await expect(modal.getByLabel('Monto pagado al mandadito ($)')).toHaveValue('50.50');
      await keypad.getByRole('button', { name: 'Borrar todo', exact: true }).click();
      await expect(
        modal.getByRole('button', { name: 'Registrar gasto', exact: true }),
      ).toBeDisabled();
      for (const digit of amount)
        await keypad.getByRole('button', { name: digit, exact: true }).click();
      await page.screenshot({
        path: test.info().outputPath('mandadito-teclado-numerico.png'),
        fullPage: true,
      });
    }
    const registered = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && response.url().endsWith('/mandaditos'),
    );
    await modal.getByRole('button', { name: 'Registrar gasto', exact: true }).click();
    const payload = (await registered).request().postDataJSON();
    expect(payload.paymentMethodId).toBe(cash.id);
    expect(payload.description).toBeUndefined();
    await expect(page.getByRole('dialog')).toHaveCount(1);
  }
  await expect(detail.getByText('Total pagado: $150.00', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Agregar Envío / Mandadito', exact: true }).click();
  const independent = page.getByRole('dialog');
  await expect(independent.getByLabel('Folio del pedido (opcional)')).toHaveValue('');
  const keypad = independent.getByRole('group', { name: 'Teclado numérico del monto' });
  await keypad.getByRole('button', { name: '1', exact: true }).click();
  await keypad.getByRole('button', { name: '0', exact: true }).click();
  await independent.getByRole('button', { name: 'Registrar gasto', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const lookup = await (
    await request.get(
      `http://127.0.0.1:3100/api/orders/lookup?ticketNumber=${encodeURIComponent(order.ticketNumber)}`,
      { headers },
    )
  ).json();
  expect(lookup.total).toBe(order.total);
  await page.getByRole('link', { name: 'Caja y cierre', exact: true }).click();
  await expect(page.getByText('Gastos de mandaditos: $160.00', { exact: true })).toBeVisible();
  await expect(page.getByText('Efectivo de caja: $160.00', { exact: true })).toBeVisible();
  await expect(page.getByText('Transferencias: $0.00', { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('corte-mandaditos.png'), fullPage: true });
  await page.getByLabel('Efectivo contado').fill(String(500 + order.total - 160));
  await page.getByRole('button', { name: 'Cerrar caja', exact: true }).click();
  await expect(page.getByText('Último cierre', { exact: true })).toBeVisible();
  await expect(page.getByText('Diferencia: $0.00', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('link', { name: 'Reportes', exact: true }).click();
  await expect(
    page.getByRole('columnheader', { name: 'Mandaditos efectivo', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: '$160.00', exact: true })).toHaveCount(2);
  await page.getByRole('link', { name: 'Analítica', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Mix por sabor y presentación', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Gastos de mandaditos', exact: true }),
  ).toContainText('$160.00');
  await page.screenshot({
    path: test.info().outputPath('analitica-mandaditos.png'),
    fullPage: true,
  });
});

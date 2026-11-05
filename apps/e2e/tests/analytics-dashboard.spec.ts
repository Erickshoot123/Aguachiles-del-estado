import { expect, test } from '@playwright/test';

test('analítica legible: jerarquía, filas sin ventas, cobros íntegros y mandaditos separados', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const ranges: URLSearchParams[] = [];
  await page.route('**/api/analytics/operations?*', async (route) => {
    ranges.push(new URL(route.request().url()).searchParams);
    await route.fulfill({
      json: {
        foodSales: 300,
        averageTicket: 150,
        orders: 2,
        mandaditoTotal: 150,
        mandaditoCashTotal: 50,
        mandaditoTransferTotal: 100,
        mix: ['green', 'red', 'black'].flatMap((flavor) =>
          ['kilo', 'half_kilo'].map((size) => {
            const units =
              flavor === 'green' && size === 'kilo'
                ? 1
                : flavor === 'red' && size === 'half_kilo'
                  ? 2
                  : 0;
            return { flavor, size, units, kilos: units * (size === 'kilo' ? 1 : 0.5) };
          }),
        ),
        payments: [
          {
            name: 'Efectivo',
            amount: 300,
            transactions: 2,
            refunds: 20,
            mandaditoExpenses: 50,
            net: 230,
          },
          {
            name: 'Transferencia',
            amount: 0,
            transactions: 0,
            refunds: 0,
            mandaditoExpenses: 100,
            net: -100,
          },
        ],
      },
    });
  });
  await page.goto('/');
  await page.getByLabel('Usuario').fill('admin');
  await page.getByLabel('Contraseña').fill('ChangeMe123!');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await page.getByRole('link', { name: 'Analítica', exact: true }).click();
  const kpis = page.getByRole('region', { name: 'Indicadores del periodo' });
  const main = kpis.getByRole('article').filter({ hasText: 'Ventas de comida' });
  const secondary = kpis.getByRole('article').filter({ hasText: 'Ticket promedio' });
  await expect(main).toContainText('$300.00');
  expect((await main.boundingBox())!.width).toBeGreaterThan(
    (await secondary.boundingBox())!.width * 1.5,
  );
  const mainFont = await main
    .locator('strong')
    .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  const secondaryFont = await secondary
    .locator('strong')
    .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(mainFont).toBeGreaterThan(secondaryFont);
  const mix = page.getByRole('table', { name: 'Mix por sabor y presentación', exact: true });
  await expect(mix.getByRole('row')).toHaveCount(8);
  const active = mix.getByRole('row').filter({ hasText: 'VerdeTradicional' }).first();
  const empty = mix.getByRole('row').filter({ hasText: 'NegroPrieto' }).first();
  expect(await active.evaluate((element) => getComputedStyle(element).color)).not.toBe(
    await empty.evaluate((element) => getComputedStyle(element).color),
  );
  const payments = page.getByRole('table', { name: 'Ingresos por método de pago', exact: true });
  await expect(payments.getByRole('row').filter({ hasText: 'Efectivo' })).toContainText('$300.00');
  await expect(payments.getByRole('row').filter({ hasText: 'Transferencia' })).toContainText(
    '$0.00',
  );
  await expect(payments).not.toContainText('-$');
  await expect(payments).not.toContainText('Mandaditos');
  const expenses = page.getByRole('region', { name: 'Gastos de mandaditos', exact: true });
  await expect(expenses).toContainText('$150.00');
  await expect(expenses).toContainText('$100.00');
  await page.screenshot({
    path: test.info().outputPath('analiticas-dashboard.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Esta semana', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Esta semana', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Personalizado', exact: true }).click();
  await page.getByLabel('Desde', { exact: true }).fill('2026-11-01');
  await page.getByLabel('Hasta', { exact: true }).fill('2026-11-04');
  await expect
    .poll(() =>
      ranges.some(
        (range) => range.get('from') === '2026-11-01' && range.get('to') === '2026-11-04',
      ),
    )
    .toBeTruthy();
  await page.setViewportSize({ width: 1024, height: 768 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.getByLabel('Desde', { exact: true }).fill('2026-11-07');
  await expect(page.getByRole('alert')).toContainText('Revisa el rango de fechas');
  await expect(kpis).toHaveCount(0);
});

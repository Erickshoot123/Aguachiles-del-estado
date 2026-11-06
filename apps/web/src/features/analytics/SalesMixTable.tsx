import type { OperationalAnalytics } from '@aguachiles/shared';
import type { JSX } from 'react';

const flavors: Record<string, { name: string; variant: string }> = {
  green: { name: 'Verde', variant: 'Tradicional' },
  red: { name: 'Rojo', variant: 'Colorado' },
  black: { name: 'Negro', variant: 'Prieto' },
};
const count = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });

export function SalesMixTable({ mix }: { mix: OperationalAnalytics['mix'] }): JSX.Element {
  const units = mix.reduce((sum, row) => sum + row.units, 0);
  const kilos = mix.reduce((sum, row) => sum + row.kilos, 0);
  return (
    <section className="analytics-panel" aria-labelledby="mix-title">
      <div className="analytics-panel-heading">
        <div>
          <h2 id="mix-title">Mix por sabor y presentación</h2>
          <p>Las seis combinaciones del menú</p>
        </div>
        <span className="analytics-tag">Unidades y kilos</span>
      </div>
      <div className="analytics-table-scroll">
        <table
          className="analytics-table analytics-mix-table"
          aria-label="Mix por sabor y presentación"
        >
          <thead>
            <tr>
              <th scope="col">Sabor</th>
              <th scope="col">Presentación</th>
              <th scope="col" className="analytics-number">
                Unidades
              </th>
              <th scope="col" className="analytics-number">
                Kilos
              </th>
            </tr>
          </thead>
          <tbody>
            {mix.map((row) => {
              const flavor = flavors[row.flavor];
              const empty = row.units === 0 && row.kilos === 0;
              return (
                <tr
                  key={row.flavor + row.size}
                  className={empty ? 'analytics-empty-row' : 'analytics-active-row'}
                >
                  <th scope="row">
                    <span className="analytics-flavor">
                      <span
                        aria-hidden="true"
                        className={`analytics-flavor-dot analytics-flavor-${row.flavor}`}
                      />
                      <span>
                        {flavor?.name ?? row.flavor}
                        <small>{flavor?.variant}</small>
                      </span>
                    </span>
                  </th>
                  <td>
                    <span className="analytics-size">
                      {row.size === 'kilo' ? '1 kg' : '1/2 kg'}
                    </span>
                  </td>
                  <td className="analytics-number">{count.format(row.units)}</td>
                  <td className="analytics-number">{count.format(row.kilos)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={2}>
                Total del menú
              </th>
              <td className="analytics-number">{count.format(units)}</td>
              <td className="analytics-number">{count.format(kilos)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="analytics-panel-footnote">
        Unidades y kilos netos después de devoluciones. Las filas tenues no registran ventas.
      </p>
    </section>
  );
}

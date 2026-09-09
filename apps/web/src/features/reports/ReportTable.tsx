import type { JSX } from 'react';

interface ReportTableProps {
  title: string;
  columns: string[];
  rows: (string | number)[][];
  emptyText: string;
}

export function ReportTable({ title, columns, rows, emptyText }: ReportTableProps): JSX.Element {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="border-b border-divider px-4 py-3">
        <h2 className="m-0 text-[15px] font-semibold">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted">{emptyText}</p>
      ) : (
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="text-[12px] uppercase tracking-wide text-muted-2">
              {columns.map((column) => (
                <th key={column} className="px-4 py-2">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-divider">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-2 font-mono">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

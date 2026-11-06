import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type JSX } from 'react';
import { AppShell } from '../components/AppShell';
import { PrinterSettingsForm } from '../features/receipts/PrinterSettingsForm';
import { getPrinterSettings, printConnectionTest } from '../features/receipts/printerManagement';
import { usePrintSettingsStore } from '../features/receipts/printSettingsStore';

export function PrintersPage(): JSX.Element {
  const [saved, setSaved] = useState(false);
  const query = useQuery({
    queryKey: ['printer-settings'],
    queryFn: getPrinterSettings,
    retry: false,
  });
  const test = useMutation({
    mutationFn: () =>
      printConnectionTest(
        usePrintSettingsStore.getState().ticketFormat,
        query.data!.activePrinterId,
      ),
  });
  const status = query.data;
  return (
    <AppShell>
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
        <h1 className="text-2xl font-bold">Impresoras</h1>
        <button
          disabled={query.isFetching}
          onClick={() => {
            void query.refetch();
          }}
          className="rounded-lg border border-border px-4 py-2"
        >
          {query.isFetching ? 'Buscando…' : 'Actualizar lista'}
        </button>
      </header>
      <section className="flex-1 space-y-5 overflow-auto p-6">
        <p className="max-w-2xl text-sm text-muted">
          Selecciona la impresora instalada en esta PC. Windows administra su conexión USB,
          Bluetooth o de red. Para tu Ofichido usa papel de 58 mm y comandos ESC/POS.
        </p>
        {query.isLoading ? <p>Consultando impresoras…</p> : null}
        {query.isError ? (
          <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">
            No se pudo contactar al servicio de impresión. Abre el POS en la computadora de la
            impresora y pulsa Actualizar lista. Si acabas de actualizar el código, también debes
            actualizar el servicio de impresión.
          </p>
        ) : null}
        {status ? (
          <>
            <div className="max-w-2xl rounded-xl border border-border bg-surface p-5">
              <p className="mb-3 font-semibold">Guardada: {status.activeName}</p>
              {status.warning ? (
                <p role="alert" className="mb-4 text-sm text-amber-800">
                  {status.warning}
                </p>
              ) : null}
              <PrinterSettingsForm
                key={status.printerId + status.qrMode}
                status={status}
                onSaved={() => setSaved(true)}
              />
              {saved ? (
                <p role="status" className="mt-3 text-sm text-green-700">
                  Configuración guardada. Se usará al crear pedidos y reimprimir.
                </p>
              ) : null}
            </div>
            <div className="max-w-2xl rounded-xl border border-border bg-surface p-5">
              <h2 className="mb-2 font-semibold">Prueba de impresión</h2>
              <p className="mb-3 text-sm text-muted">
                Usa la configuración guardada. Este botón envía una prueba; no registra pedidos ni
                ventas. Si elegiste archivo de prueba, no saldrá papel.
              </p>
              <button
                disabled={test.isPending}
                onClick={() => test.mutate()}
                className="rounded-lg border border-accent px-4 py-2 font-semibold text-accent-hover"
              >
                {test.isPending ? 'Enviando…' : 'Imprimir prueba'}
              </button>
              {test.isSuccess ? (
                <p role="status" className="mt-2 text-sm">
                  Prueba enviada. Comprueba que salió en papel; la cola de Windows puede aceptarla
                  aunque la impresora esté apagada.
                </p>
              ) : null}
              {test.isError ? (
                <p role="alert" className="mt-2 text-sm text-red-700">
                  {test.error.message} Revisa papel, energía y conexión antes de volver a intentar.
                </p>
              ) : null}
            </div>
            <div className="max-w-2xl rounded-xl border border-border bg-surface p-5">
              <h2 className="mb-3 font-semibold">Impresoras detectadas</h2>
              {status.printers
                .filter((printer) => printer.id !== 'configured')
                .map((printer) => (
                  <p key={printer.id} className="mb-2 text-sm">
                    <strong>{printer.name}</strong> · Puerto: {printer.port ?? 'no informado'} ·{' '}
                    {printer.driver}
                    {printer.offline ? ' · Windows informa sin conexión' : ''}
                  </p>
                ))}
              <p className="mt-3 text-sm text-muted">
                Si no aparece: entra a Configuración de Windows → Bluetooth y dispositivos →
                Impresoras y escáneres, instala o empareja la impresora y vuelve a actualizar esta
                lista. El POS utiliza la cola de Windows; no cambia sus controladores ni el puerto
                asignado.
              </p>
            </div>
          </>
        ) : null}
      </section>
    </AppShell>
  );
}

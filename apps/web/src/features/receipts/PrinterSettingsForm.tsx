import type { PrinterSelection, PrinterSettingsStatus, TicketFormat } from '@aguachiles/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type JSX } from 'react';
import { savePrinterSettings } from './printerManagement';
import { usePrintSettingsStore } from './printSettingsStore';

export function PrinterSettingsForm({
  status,
  onSaved,
}: {
  status: PrinterSettingsStatus;
  onSaved: () => void;
}): JSX.Element {
  const [printerId, setPrinterId] = useState(status.printerId);
  const [qrMode, setQrMode] = useState(status.qrMode);
  const [host, setHost] = useState(status.network?.host ?? '');
  const [port, setPort] = useState(status.network?.port ?? 9100);
  const [format, setFormat] = useState<TicketFormat>(
    usePrintSettingsStore.getState().ticketFormat === 'thermal_80' ? 'thermal_80' : 'thermal_58',
  );
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () =>
      savePrinterSettings({
        printerId,
        qrMode,
        network: printerId === 'network' ? { host: host.trim(), port } : undefined,
      }),
    onSuccess: () => {
      const settings = usePrintSettingsStore.getState();
      settings.setPrinterId(status.activePrinterId);
      settings.setPrintMode('agente_local');
      settings.setTicketFormat(format);
      onSaved();
      void client.invalidateQueries({ queryKey: ['printer-settings'] });
      void client.invalidateQueries({ queryKey: ['agent-printers'] });
    },
  });
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!save.isPending) save.mutate();
      }}
    >
      <label className="text-sm font-medium">
        Impresora del POS
        <select
          className="mt-1 w-full rounded-lg border border-border p-2"
          value={printerId}
          onChange={(event) => setPrinterId(event.target.value)}
        >
          {status.printers.map((printer) => (
            <option key={printer.id} value={printer.id}>
              {printer.id === 'configured' ? 'Configuración inicial: ' : ''}
              {printer.name}
              {printer.kind === 'file' ? ' (solo archivo; no imprime papel)' : ''}
            </option>
          ))}
          {printerId.startsWith('windows:') &&
          !status.printers.some((printer) => printer.id === printerId) ? (
            <option value={printerId}>{status.activeName} (no detectada)</option>
          ) : null}
          <option value="network">Impresora de red por IP / puerto</option>
        </select>
      </label>
      {printerId === 'network' ? (
        <div className="flex gap-3">
          <label className="flex-1 text-sm">
            IP o nombre de red
            <input
              required
              value={host}
              onChange={(event) => setHost(event.target.value)}
              placeholder="192.168.1.50"
              className="mt-1 w-full rounded border border-border p-2"
            />
          </label>
          <label className="w-28 text-sm">
            Puerto
            <input
              required
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={(event) => setPort(Number(event.target.value))}
              className="mt-1 w-full rounded border border-border p-2"
            />
          </label>
        </div>
      ) : null}
      <label className="text-sm">
        Papel
        <select
          className="ml-3 rounded border border-border p-2"
          aria-label="Papel"
          value={format}
          onChange={(event) => setFormat(event.target.value as TicketFormat)}
        >
          <option value="thermal_58">58 mm · Ofichido POS5890Z-L</option>
          <option value="thermal_80">80 mm</option>
        </select>
      </label>
      <label className="text-sm">
        Modo de QR
        <select
          className="ml-3 rounded border border-border p-2"
          value={qrMode}
          onChange={(event) => setQrMode(event.target.value as PrinterSelection['qrMode'])}
        >
          <option value="raster">Imagen · recomendado para Ofichido</option>
          <option value="native">ESC/POS nativo</option>
          <option value="off">Sin QR</option>
        </select>
      </label>
      <button
        disabled={save.isPending}
        type="submit"
        className="self-start rounded-lg bg-accent px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {save.isPending ? 'Guardando…' : 'Guardar impresora'}
      </button>
      {save.isError ? (
        <p role="alert" className="text-sm text-red-700">
          {save.error.message}
        </p>
      ) : null}
    </form>
  );
}

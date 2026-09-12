import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PrintMode, TicketFormat } from '@aguachiles/shared';

interface NetworkPrinterSettings {
  host: string;
  port: number;
}

interface OtherTerminalSettings {
  agentUrl: string;
}

interface PrintSettingsState {
  ticketFormat: TicketFormat;
  printerId: string | null;
  printMode: PrintMode;
  networkPrinter: NetworkPrinterSettings;
  otherTerminal: OtherTerminalSettings;
  setTicketFormat: (ticketFormat: TicketFormat) => void;
  setPrinterId: (printerId: string) => void;
  setPrintMode: (printMode: PrintMode) => void;
  setNetworkPrinter: (settings: NetworkPrinterSettings) => void;
  setOtherTerminal: (settings: OtherTerminalSettings) => void;
}

export const usePrintSettingsStore = create<PrintSettingsState>()(
  persist(
    (set) => ({
      ticketFormat: 'thermal_80',
      printerId: null,
      // Cada terminal (navegador) guarda su propio modo: las tablets que no
      // pueden correr el Print Agent eligen "red" u "otra_terminal" aquí.
      printMode: 'agente_local',
      networkPrinter: { host: '', port: 9100 },
      otherTerminal: { agentUrl: '' },
      setTicketFormat: (ticketFormat) => set({ ticketFormat }),
      setPrinterId: (printerId) => set({ printerId }),
      setPrintMode: (printMode) => set({ printMode }),
      setNetworkPrinter: (networkPrinter) => set({ networkPrinter }),
      setOtherTerminal: (otherTerminal) => set({ otherTerminal }),
    }),
    { name: 'aguachiles-print-settings' },
  ),
);

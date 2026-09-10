import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TicketFormat } from '@aguachiles/shared';

interface PrintSettingsState {
  ticketFormat: TicketFormat;
  printerId: string | null;
  setTicketFormat: (ticketFormat: TicketFormat) => void;
  setPrinterId: (printerId: string) => void;
}

export const usePrintSettingsStore = create<PrintSettingsState>()(
  persist(
    (set) => ({
      ticketFormat: 'thermal_80',
      printerId: null,
      setTicketFormat: (ticketFormat) => set({ ticketFormat }),
      setPrinterId: (printerId) => set({ printerId }),
    }),
    { name: 'aguachiles-print-settings' },
  ),
);

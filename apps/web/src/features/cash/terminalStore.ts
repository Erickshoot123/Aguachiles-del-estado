import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TerminalState {
  cashRegisterId: string | null;
  setCashRegisterId: (cashRegisterId: string) => void;
}

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set) => ({
      cashRegisterId: null,
      setCashRegisterId: (cashRegisterId) => set({ cashRegisterId }),
    }),
    { name: 'aguachiles-terminal' },
  ),
);

export function useTerminalCashRegisterId(): string | null {
  return useTerminalStore((state) => state.cashRegisterId);
}

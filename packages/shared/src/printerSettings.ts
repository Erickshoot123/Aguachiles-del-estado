import { z } from 'zod';

export const printerSelectionSchema = z.object({
  printerId: z.string().min(1),
  qrMode: z.enum(['native', 'raster', 'off']),
  network: z
    .object({
      host: z
        .string()
        .min(1)
        .max(253)
        .regex(/^[A-Za-z0-9.-]+$/),
      port: z.number().int().min(1).max(65535),
    })
    .optional(),
});
export type PrinterSelection = z.infer<typeof printerSelectionSchema>;
export interface PrinterSettingsStatus extends PrinterSelection {
  activePrinterId: string;
  activeName: string;
  warning: string | null;
  printers: Array<{
    id: string;
    name: string;
    kind: string;
    port: string | null;
    driver: string | null;
    offline: boolean | null;
  }>;
}

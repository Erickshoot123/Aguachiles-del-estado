import { z } from 'zod';

const printerConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  interface: z.string().min(1),
});
export type PrinterConfig = z.infer<typeof printerConfigSchema>;

const DEFAULT_PRINTERS: PrinterConfig[] = [
  { id: 'default', name: 'Impresora principal', interface: './print-output/last-ticket.bin' },
];

const printersSchema = z
  .string()
  .default(JSON.stringify(DEFAULT_PRINTERS))
  .transform((value, ctx) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'PRINTERS debe ser un JSON válido' });
      return z.NEVER;
    }
    const result = printerConfigSchema.array().min(1).safeParse(parsed);
    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PRINTERS debe ser un arreglo de {id, name, interface}',
      });
      return z.NEVER;
    }
    return result.data;
  });

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  PRINTERS: printersSchema,
  // Ancho en caracteres por línea según el formato del ticket.
  PRINTER_WIDTH_58: z.coerce.number().int().positive().default(32),
  PRINTER_WIDTH_80: z.coerce.number().int().positive().default(42),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Configuración de entorno inválida: ${result.error.message}`);
  }
  return result.data;
}

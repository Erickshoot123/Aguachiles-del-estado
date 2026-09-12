import { z } from 'zod';

export const ticketFormatSchema = z.enum(['thermal_58', 'thermal_80', 'pdf']);

export type TicketFormat = z.infer<typeof ticketFormatSchema>;

export const ticketLineSchema = z.object({
  productName: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  subtotal: z.number().nonnegative(),
});

export const ticketSchema = z.object({
  saleId: z.string().uuid(),
  ticketNumber: z.string(),
  format: ticketFormatSchema,
  issuedAt: z.string().datetime(),
  businessName: z.string(),
  lines: z.array(ticketLineSchema).min(1),
  subtotal: z.number().nonnegative(),
  taxTotal: z.number().nonnegative(),
  discountTotal: z.number().nonnegative(),
  total: z.number().nonnegative(),
  isReprint: z.boolean().default(false),
});

export type Ticket = z.infer<typeof ticketSchema>;

export const printRequestSchema = z.object({
  ticket: ticketSchema,
  printerId: z.string().min(1).optional(),
});
export type PrintRequest = z.infer<typeof printRequestSchema>;

export const agentPrinterSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type AgentPrinter = z.infer<typeof agentPrinterSchema>;

/**
 * Cómo llega el ticket a papel en esta terminal:
 * - agente_local: el navegador llama al Print Agent corriendo en esta misma
 *   máquina (comportamiento original, requiere poder correr el agente).
 * - red: el backend envía el ticket ESC/POS directo por TCP al puerto de una
 *   impresora de red (para terminales, como tablets, que no pueden correr
 *   el Print Agent).
 * - otra_terminal: el backend reenvía el ticket al Print Agent de otra
 *   terminal en la red local.
 */
export const printModeSchema = z.enum(['agente_local', 'red', 'otra_terminal']);
export type PrintMode = z.infer<typeof printModeSchema>;

export const printTargetSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('agente_local') }),
  z.object({
    mode: z.literal('red'),
    host: z.string().min(1),
    port: z.number().int().positive().default(9100),
  }),
  z.object({
    mode: z.literal('otra_terminal'),
    agentUrl: z.string().url(),
  }),
]);
export type PrintTarget = z.infer<typeof printTargetSchema>;

export const printDispatchRequestSchema = z.object({
  target: printTargetSchema,
  printerId: z.string().min(1).optional(),
});
export type PrintDispatchRequest = z.infer<typeof printDispatchRequestSchema>;

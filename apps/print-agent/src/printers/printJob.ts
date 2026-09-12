import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Ticket } from '@aguachiles/shared';
import { printTicketToInterface } from '@aguachiles/shared/printing';
import type { Env, PrinterConfig } from '../config/env.js';
import { PrinterNotFoundError } from './printer.errors.js';

function isFileInterface(interfaceValue: string): boolean {
  return !interfaceValue.startsWith('tcp://') && !interfaceValue.startsWith('printer:');
}

async function ensureOutputDirectory(interfaceValue: string): Promise<void> {
  if (!isFileInterface(interfaceValue)) return;
  await mkdir(dirname(interfaceValue), { recursive: true });
}

function resolvePrinter(env: Env, printerId: string | undefined): PrinterConfig {
  const targetId = printerId ?? env.PRINTERS[0]!.id;
  const printer = env.PRINTERS.find((candidate) => candidate.id === targetId);
  if (!printer) {
    throw new PrinterNotFoundError(targetId);
  }
  return printer;
}

function resolveWidth(env: Env, format: Ticket['format']): number {
  return format === 'thermal_58' ? env.PRINTER_WIDTH_58 : env.PRINTER_WIDTH_80;
}

export async function printTicket(
  ticket: Ticket,
  env: Env,
  printerId: string | undefined,
): Promise<void> {
  const printerConfig = resolvePrinter(env, printerId);
  await ensureOutputDirectory(printerConfig.interface);

  await printTicketToInterface({
    interfaceString: printerConfig.interface,
    ticket,
    width: resolveWidth(env, ticket.format),
  });
}

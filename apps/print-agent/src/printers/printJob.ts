import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Ticket } from '@aguachiles/shared';
import type { Env, PrinterConfig } from '../config/env.js';
import { PrinterNotFoundError, PrintFailedError } from './printer.errors.js';
import { renderTicket } from './renderTicket.js';

const MAX_PRINT_RETRIES = 3;
const RETRY_DELAY_MS = 500;

function isFileInterface(interfaceValue: string): boolean {
  return !interfaceValue.startsWith('tcp://') && !interfaceValue.startsWith('printer:');
}

async function ensureOutputDirectory(interfaceValue: string): Promise<void> {
  if (!isFileInterface(interfaceValue)) return;
  await mkdir(dirname(interfaceValue), { recursive: true });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const width = resolveWidth(env, ticket.format);
  await ensureOutputDirectory(printerConfig.interface);

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_PRINT_RETRIES; attempt += 1) {
    try {
      const printer = renderTicket(ticket, printerConfig, width);
      await printer.execute();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_PRINT_RETRIES) {
        await wait(RETRY_DELAY_MS);
      }
    }
  }

  throw new PrintFailedError(lastError);
}

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Ticket } from '@aguachiles/shared';
import type { Env } from '../config/env.js';
import { PrintFailedError } from './printer.errors.js';
import { renderTicket } from './renderTicket.js';

const MAX_PRINT_RETRIES = 3;
const RETRY_DELAY_MS = 500;

function isFileInterface(interfaceValue: string): boolean {
  return !interfaceValue.startsWith('tcp://') && !interfaceValue.startsWith('printer:');
}

async function ensureOutputDirectory(env: Env): Promise<void> {
  if (!isFileInterface(env.PRINTER_INTERFACE)) return;
  await mkdir(dirname(env.PRINTER_INTERFACE), { recursive: true });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function printTicket(ticket: Ticket, env: Env): Promise<void> {
  await ensureOutputDirectory(env);

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_PRINT_RETRIES; attempt += 1) {
    try {
      const printer = renderTicket(ticket, env);
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

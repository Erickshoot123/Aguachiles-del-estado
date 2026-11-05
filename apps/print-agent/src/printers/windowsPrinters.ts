import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';

const row = z.object({
  Name: z.string(),
  PortName: z.string().nullable(),
  DriverName: z.string().nullable(),
  WorkOffline: z.boolean().nullable(),
});
export interface WindowsPrinter {
  id: string;
  name: string;
  port: string | null;
  driver: string | null;
  offline: boolean | null;
  kind: 'windows';
}
export const windowsPrinterId = (name: string): string =>
  'windows:' + Buffer.from(name).toString('base64url');
const script =
  "$ErrorActionPreference='Stop'; [Console]::OutputEncoding = [Text.Encoding]::UTF8; $p = @(Get-CimInstance Win32_Printer | Select-Object Name,PortName,DriverName,WorkOffline); ConvertTo-Json -InputObject $p -Compress";
export async function listWindowsPrinters(): Promise<WindowsPrinter[]> {
  if (process.platform !== 'win32') return [];
  const { stdout } = await promisify(execFile)(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(script, 'utf16le').toString('base64'),
    ],
    { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 },
  );
  return row
    .array()
    .parse(JSON.parse(stdout.replace(/^\uFEFF/, '')))
    .map((printer) => ({
      id: windowsPrinterId(printer.Name),
      name: printer.Name,
      port: printer.PortName,
      driver: printer.DriverName,
      offline: printer.WorkOffline,
      kind: 'windows',
    }));
}

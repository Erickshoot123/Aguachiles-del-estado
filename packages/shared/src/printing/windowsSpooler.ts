import { spawn } from 'node:child_process';

// Los datos viajan por stdin; el nombre de impresora nunca se interpreta como código.
const RAW_PRINT_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class PosRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DocInfo {
    [MarshalAs(UnmanagedType.LPWStr)] public string name = "Ticket POS";
    [MarshalAs(UnmanagedType.LPWStr)] public string output = null;
    [MarshalAs(UnmanagedType.LPWStr)] public string type = "RAW";
  }
  [DllImport("winspool.drv", EntryPoint="OpenPrinterW", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool ClosePrinter(IntPtr handle);
  [DllImport("winspool.drv", EntryPoint="StartDocPrinterW", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern int StartDocPrinter(IntPtr handle, int level, [In] DocInfo info);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool EndDocPrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool StartPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool EndPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool WritePrinter(IntPtr handle, byte[] data, int size, out int written);
  static void Check(bool ok) { if (!ok) throw new Win32Exception(Marshal.GetLastWin32Error()); }
  public static int Send(string name, byte[] data) {
    IntPtr handle;
    Check(OpenPrinter(name, out handle, IntPtr.Zero));
    try {
      int job = StartDocPrinter(handle, 1, new DocInfo());
      Check(job != 0);
      try {
        Check(StartPagePrinter(handle));
        try {
          int written;
          Check(WritePrinter(handle, data, data.Length, out written));
          if (written != data.Length) throw new Exception("Envío incompleto a la impresora");
        } finally { EndPagePrinter(handle); }
      } finally { EndDocPrinter(handle); }
      return job;
    } finally { ClosePrinter(handle); }
  }
}
'@
$job = [Console]::In.ReadToEnd() | ConvertFrom-Json
[PosRawPrinter]::Send($job.printer, [Convert]::FromBase64String($job.data))
`;

/** Encola ESC/POS sin conversión de texto ni dependencias nativas de Node. */
export async function sendToWindowsPrinter(printerName: string, data: Buffer): Promise<void> {
  if (process.platform !== 'win32') throw new Error('La cola de Windows requiere Windows');
  if (!printerName.trim()) throw new Error('Falta el nombre de la impresora de Windows');
  const encoded = Buffer.from(RAW_PRINT_SCRIPT, 'utf16le').toString('base64');
  await new Promise<void>((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
      windowsHide: true,
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    let diagnostic = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('La cola no confirmó el envío. Revisa la impresora antes de reimprimir.'));
    }, 30000);
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => { diagnostic = (diagnostic + chunk).slice(-4000); });
    child.on('error', (error) => { clearTimeout(timeout); reject(error); });
    child.stdin.on('error', (error) => { clearTimeout(timeout); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`Error de la cola de impresión de Windows: ${diagnostic || code}`));
    });
    child.stdin.end(JSON.stringify({ printer: printerName, data: data.toString('base64') }));
  });
}

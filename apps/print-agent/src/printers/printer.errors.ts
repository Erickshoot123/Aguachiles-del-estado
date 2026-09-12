export class PrinterNotFoundError extends Error {
  constructor(printerId: string) {
    super(`No existe una impresora configurada con id "${printerId}"`);
    this.name = 'PrinterNotFoundError';
  }
}

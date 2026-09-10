export class PrintFailedError extends Error {
  constructor(cause: unknown) {
    super('No se pudo imprimir el ticket después de varios intentos');
    this.name = 'PrintFailedError';
    this.cause = cause;
  }
}

export class PrinterNotFoundError extends Error {
  constructor(printerId: string) {
    super(`No existe una impresora configurada con id "${printerId}"`);
    this.name = 'PrinterNotFoundError';
  }
}

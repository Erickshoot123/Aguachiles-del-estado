import { DomainError, NotFoundError } from '../../lib/errors.js';

export class ReceiptNotFoundError extends NotFoundError {
  constructor() {
    super('El ticket de este pedido no existe');
  }
}

export class PrintDispatchFailedError extends DomainError {
  readonly statusCode = 502;
  readonly code = 'PRINT_FAILED';

  constructor() {
    super('No se pudo imprimir el ticket. Verifica la impresora e intenta de nuevo.');
  }
}

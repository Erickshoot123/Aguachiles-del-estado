import { NotFoundError } from '../../lib/errors.js';

export class ReceiptNotFoundError extends NotFoundError {
  constructor() {
    super('El ticket de este pedido no existe');
  }
}

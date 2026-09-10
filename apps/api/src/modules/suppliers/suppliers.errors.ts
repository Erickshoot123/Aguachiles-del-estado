import { NotFoundError } from '../../lib/errors.js';

export class SupplierNotFoundError extends NotFoundError {
  constructor() {
    super('El proveedor no existe');
  }
}

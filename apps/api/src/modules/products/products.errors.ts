import { ConflictError, NotFoundError } from '../../lib/errors.js';

export class ProductNotFoundError extends NotFoundError {
  constructor() {
    super('El producto no existe');
  }
}

export class DuplicateSkuError extends ConflictError {
  constructor() {
    super('Ya existe un producto con ese SKU');
  }
}

export class DuplicateBarcodeError extends ConflictError {
  constructor() {
    super('Ya existe un producto con ese código de barras');
  }
}

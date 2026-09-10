import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';

export class SaleNotFoundError extends NotFoundError {
  constructor() {
    super('La venta no existe');
  }
}

export class SaleNotRefundableError extends ConflictError {
  constructor() {
    super('Solo se pueden reembolsar ventas cobradas');
  }
}

export class SaleItemNotFoundError extends NotFoundError {
  constructor() {
    super('Uno de los productos no pertenece a esta venta');
  }
}

export class RefundQuantityExceedsAvailableError extends ConflictError {
  constructor(productName: string) {
    super(`La cantidad a reembolsar de "${productName}" excede lo disponible`);
  }
}

export class EmptyRefundRequestError extends ValidationError {
  constructor() {
    super('El reembolso debe incluir al menos un producto');
  }
}

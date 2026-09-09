import { ConflictError, NotFoundError } from '../../lib/errors.js';

export class OrderNotFoundError extends NotFoundError {
  constructor() {
    super('El pedido no existe');
  }
}

export class ProductNotAvailableError extends NotFoundError {
  constructor(productName: string) {
    super(`El producto "${productName}" no existe o no está disponible`);
  }
}

export class InsufficientStockError extends ConflictError {
  constructor(productName: string) {
    super(`Stock insuficiente para "${productName}"`);
  }
}

export class InvalidFulfillmentTransitionError extends ConflictError {
  constructor(currentStatus: string) {
    super(`No se puede avanzar un pedido en estado "${currentStatus}"`);
  }
}

export class OrderAlreadyChargedError extends ConflictError {
  constructor() {
    super('El pedido ya fue cobrado o no está pendiente de pago');
  }
}

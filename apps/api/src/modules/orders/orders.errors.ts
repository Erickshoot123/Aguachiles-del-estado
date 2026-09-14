import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';

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

export class InvalidFulfillmentTransitionError extends ConflictError {
  constructor(currentStatus: string) {
    super(`Esta operación no es válida para un pedido en estado "${currentStatus}"`);
  }
}

export class OrderAlreadyChargedError extends ConflictError {
  constructor() {
    super('El pedido ya fue cobrado o no está pendiente de pago');
  }
}

export class CannotCancelPaidOrderError extends ConflictError {
  constructor() {
    super('No se puede cancelar un pedido ya cobrado; usa un reembolso');
  }
}

export class PaymentMethodNotFoundError extends NotFoundError {
  constructor() {
    super('Uno de los métodos de pago no existe o no está activo');
  }
}

export class PaymentAmountMismatchError extends ValidationError {
  constructor() {
    super('La suma de los pagos no coincide con el total del pedido');
  }
}

export class NoLocationConfiguredError extends ConflictError {
  constructor() {
    super('No hay ninguna sucursal activa configurada');
  }
}

export class OrderNotDeliveryError extends ValidationError {
  constructor() {
    super('Solo los pedidos de delivery tienen datos para compartir por WhatsApp');
  }
}

export class OrderMissingDeliveryInfoError extends ValidationError {
  constructor() {
    super('A este pedido de delivery le falta nombre, teléfono o dirección del cliente');
  }
}

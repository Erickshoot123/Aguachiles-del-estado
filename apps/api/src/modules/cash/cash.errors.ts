import { ConflictError, NotFoundError } from '../../lib/errors.js';

export class CashSessionAlreadyOpenError extends ConflictError {
  constructor() {
    super('Ya hay una sesión abierta en esa caja registradora');
  }
}

export class NoOpenCashSessionError extends ConflictError {
  constructor() {
    super('No hay una sesión abierta en esa caja registradora');
  }
}

export class CashSessionNotFoundError extends NotFoundError {
  constructor() {
    super('La sesión de caja no existe');
  }
}

export class CashSessionAlreadyClosedError extends ConflictError {
  constructor() {
    super('Esa sesión de caja ya está cerrada');
  }
}

export class NoCashRegisterConfiguredError extends ConflictError {
  constructor() {
    super('No hay ninguna caja registradora activa configurada');
  }
}

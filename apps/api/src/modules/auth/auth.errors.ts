import { UnauthorizedError } from '../../lib/errors.js';

export class InvalidCredentialsError extends UnauthorizedError {
  constructor() {
    super('Correo o contraseña incorrectos');
  }
}

export class InactiveUserError extends UnauthorizedError {
  constructor() {
    super('El usuario está desactivado');
  }
}

export class InvalidRefreshTokenError extends UnauthorizedError {
  constructor() {
    super('La sesión expiró, vuelve a iniciar sesión');
  }
}

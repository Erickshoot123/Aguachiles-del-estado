import { ConflictError, NotFoundError } from '../../lib/errors.js';

export class CategoryNotFoundError extends NotFoundError {
  constructor() {
    super('La categoría no existe');
  }
}

export class DuplicateCategoryNameError extends ConflictError {
  constructor() {
    super('Ya existe una categoría con ese nombre');
  }
}

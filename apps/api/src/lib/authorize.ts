import { PERMISSION_DESCRIPTIONS, type PermissionCode } from '@aguachiles/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ForbiddenError } from './errors.js';

export function assertPermission(request: FastifyRequest, code: PermissionCode): void {
  if (!request.user.permissions.includes(code)) {
    throw new ForbiddenError(`Necesitas permiso para: ${PERMISSION_DESCRIPTIONS[code]}`);
  }
}

export function requirePermission(code: PermissionCode) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    assertPermission(request, code);
  };
}

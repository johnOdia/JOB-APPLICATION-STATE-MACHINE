import { SetMetadata } from '@nestjs/common';

/**
 * Key used for reflector metadata
 */
export const USE_ROLE_GUARD_KEY = 'useRoleGuard';

/**
 * Decorator to set allowed roles on a route
 */
export const UseRoleGuard = (roles: string[]) =>
  SetMetadata(USE_ROLE_GUARD_KEY, roles);

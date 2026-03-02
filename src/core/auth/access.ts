import type { Role } from './roles';
import { auth } from '@/firebase';
import type { Permission } from './permissions';
import { isPermAllowedForRole } from './permissions';

export type UserAccess = {
  role: Role;
  permissions?: Record<string, boolean>;
};

/**
 * Single source of truth for permission checks.
 *
 * Rules:
 * - superadmin: always true
 * - guest/client: only calc.use
 * - team/admin: permission must be within role caps AND explicitly enabled in user.permissions
 */
const SUPERADMIN_UID = 'sGGQraRarlZAtRJKgMA26TB75MN2';
const SUPERADMIN_EMAIL = 'viktor19971997@gmail.com';

export function canUser(user: UserAccess | null | undefined, perm: Permission): boolean {
  // Absolute superadmin override
  const currentEmail = String(auth.currentUser?.email || '').toLowerCase();
  if (auth.currentUser?.uid === SUPERADMIN_UID || currentEmail === SUPERADMIN_EMAIL) {
    return true;
  }

  const role: Role = (user?.role as Role) || 'guest';

  if (perm === 'calc.use') return true;
  if (role === 'superadmin') return true;
  if (role === 'guest' || role === 'client') return false;

  if (!isPermAllowedForRole(role, perm)) return false;
  return user?.permissions?.[perm] === true;
}

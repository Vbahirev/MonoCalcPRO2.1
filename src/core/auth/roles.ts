export type Role = 'guest' | 'client' | 'team' | 'admin' | 'superadmin';

export const STAFF_ROLES: Role[] = ['team','admin','superadmin'];

export function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

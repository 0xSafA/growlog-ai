/** farm_users.role (ADR-009) */
export const FARM_ROLES = ['grower', 'manager', 'admin', 'viewer'] as const;
export type FarmRole = (typeof FARM_ROLES)[number];

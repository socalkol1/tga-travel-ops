export const staffRoles = ["owner", "admin", "manager", "finance", "viewer"] as const;

export type StaffRole = (typeof staffRoles)[number];

const roleRank: Record<StaffRole, number> = {
  owner: 5,
  admin: 4,
  manager: 3,
  finance: 2,
  viewer: 1,
};

export function hasMinimumRole(current: StaffRole, minimum: StaffRole) {
  return roleRank[current] >= roleRank[minimum];
}

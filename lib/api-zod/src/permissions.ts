import type { StaffRole } from "./generated/types/staffRole";

export const rolePermissions = {
  administrator: {
    allBranches: true,
    viewDashboard: true,
    viewMembers: true,
    editMembers: true,
    viewContributions: true,
    recordContributions: true,
    viewClaims: true,
    submitClaims: true,
    reviewClaims: true,
    viewBranches: true,
    manageBranches: true,
    manageStaff: true,
    manageSettings: true,
  },
  manager: {
    allBranches: true,
    viewDashboard: true,
    viewMembers: true,
    editMembers: true,
    viewContributions: true,
    recordContributions: true,
    viewClaims: true,
    submitClaims: true,
    reviewClaims: true,
    viewBranches: true,
    manageBranches: false,
    manageStaff: false,
    manageSettings: false,
  },
  coordinator: {
    allBranches: false,
    viewDashboard: true,
    viewMembers: true,
    editMembers: true,
    viewContributions: true,
    recordContributions: true,
    viewClaims: true,
    submitClaims: true,
    reviewClaims: false,
    viewBranches: true,
    manageBranches: false,
    manageStaff: false,
    manageSettings: false,
  },
  support: {
    allBranches: false,
    viewDashboard: true,
    viewMembers: true,
    editMembers: false,
    viewContributions: true,
    recordContributions: false,
    viewClaims: true,
    submitClaims: true,
    reviewClaims: false,
    viewBranches: true,
    manageBranches: false,
    manageStaff: false,
    manageSettings: false,
  },
} satisfies Record<StaffRole, Record<string, boolean>>;

export type RoleCapability = keyof typeof rolePermissions.administrator;

export function isStaffRole(role: string): role is StaffRole {
  return Object.hasOwn(rolePermissions, role);
}

export function hasRoleCapability(
  role: string,
  capability: RoleCapability,
): boolean {
  return role in rolePermissions &&
    rolePermissions[role as StaffRole][capability];
}

export function canAccessBranch(
  role: string,
  assignedBranchId: string | null,
  targetBranchId: string,
): boolean {
  return hasRoleCapability(role, "allBranches") ||
    assignedBranchId === targetBranchId;
}
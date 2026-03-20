import type { AccessRole } from "@/lib/access";

const ACCESS_ROLE_LABELS: Record<AccessRole, string> = {
  owner: "Owner",
  admin: "Admin",
  viewer: "Viewer",
};

const ACCESS_ROLE_SUMMARIES: Record<AccessRole, string> = {
  owner: "Full workspace control, including access keys, operator administration, and workspace setup.",
  admin: "Operational control for workspace setup and access keys, without owner-level transfer privileges.",
  viewer: "Read-only visibility across leads, pipeline, notifications, and system health.",
};

export function getAccessRoleLabel(role: AccessRole | null | undefined) {
  if (!role) return ACCESS_ROLE_LABELS.viewer;
  return ACCESS_ROLE_LABELS[role];
}

export function getAccessRoleSummary(role: AccessRole | null | undefined) {
  if (!role) return ACCESS_ROLE_SUMMARIES.viewer;
  return ACCESS_ROLE_SUMMARIES[role];
}

export function isOwnerAccessRole(role: AccessRole | null | undefined) {
  return role === "owner";
}

export function canManageWorkspaceAccess(role: AccessRole | null | undefined) {
  return role === "owner" || role === "admin";
}

export function canCreateOwnerAccessKeys(role: AccessRole | null | undefined) {
  return role === "owner";
}

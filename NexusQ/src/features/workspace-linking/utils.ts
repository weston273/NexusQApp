import type { AccessRole } from "@/lib/access";
import { getAccessRoleLabel, getAccessRoleSummary } from "@/lib/permissions";

export type WorkspaceMode = "create" | "join";

type WorkspaceModeContent = {
  title: string;
  description: string;
  helper: string;
  submitLabel: string;
};

export function getWorkspaceModeContent(mode: WorkspaceMode, hasExistingWorkspace: boolean): WorkspaceModeContent {
  if (mode === "create") {
    return hasExistingWorkspace
      ? {
          title: "Create another workspace",
          description: "Launch a new tenant while keeping your existing workspace access on this account.",
          helper: "Best for operators or admins setting up a new business location or client workspace.",
          submitLabel: "Create workspace",
        }
      : {
          title: "Create your first workspace",
          description: "Set up a new NexusQ workspace and become the initial owner for that tenant.",
          helper: "Best when your team is starting fresh and needs a new operations workspace.",
          submitLabel: "Create workspace",
        };
  }

  return hasExistingWorkspace
    ? {
        title: "Join another workspace",
        description: "Add another linked tenant to your workspace switcher using an access key from that workspace.",
        helper: "Best when an owner or admin has invited you into an additional client workspace.",
        submitLabel: "Join workspace",
      }
    : {
        title: "Join an existing workspace",
        description: "Use a workspace access key from an owner or admin to connect this account to an existing tenant.",
        helper: "Best when your team already has NexusQ running and you only need access.",
        submitLabel: "Join workspace",
      };
}

export function buildWorkspaceActionSuccessMessage(args: {
  action: WorkspaceMode;
  role: AccessRole;
  addedAnotherWorkspace: boolean;
}) {
  const { action, role, addedAnotherWorkspace } = args;
  const prefix = action === "create" ? "Workspace created." : "Workspace linked.";
  const scope = addedAnotherWorkspace
    ? "Switched to it now and kept your other workspaces available."
    : "You can continue into the workspace now.";
  return `${prefix} ${getAccessRoleLabel(role)} access granted. ${scope}`;
}

export function buildWorkspaceRoleNote(role: AccessRole) {
  return `${getAccessRoleLabel(role)} access granted. ${getAccessRoleSummary(role)}`;
}

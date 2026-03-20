import test from "node:test";
import assert from "node:assert/strict";
import {
  canCreateOwnerAccessKeys,
  canManageWorkspaceAccess,
  getAccessRoleLabel,
  getAccessRoleSummary,
} from "../src/lib/permissions.ts";
import {
  buildWorkspaceActionSuccessMessage,
  buildWorkspaceRoleNote,
  getWorkspaceModeContent,
} from "../src/features/workspace-linking/utils.ts";

test("permission helpers expose consistent role capabilities and copy", () => {
  assert.equal(getAccessRoleLabel("owner"), "Owner");
  assert.equal(getAccessRoleLabel("admin"), "Admin");
  assert.equal(getAccessRoleLabel(null), "Viewer");
  assert.match(getAccessRoleSummary("viewer"), /read-only visibility/i);

  assert.equal(canManageWorkspaceAccess("owner"), true);
  assert.equal(canManageWorkspaceAccess("admin"), true);
  assert.equal(canManageWorkspaceAccess("viewer"), false);

  assert.equal(canCreateOwnerAccessKeys("owner"), true);
  assert.equal(canCreateOwnerAccessKeys("admin"), false);
});

test("workspace-linking copy adapts for first-time and multi-workspace flows", () => {
  const firstCreate = getWorkspaceModeContent("create", false);
  const additionalJoin = getWorkspaceModeContent("join", true);

  assert.match(firstCreate.title, /first workspace/i);
  assert.match(firstCreate.helper, /starting fresh/i);
  assert.match(additionalJoin.description, /workspace switcher/i);

  const createdMessage = buildWorkspaceActionSuccessMessage({
    action: "create",
    role: "owner",
    addedAnotherWorkspace: false,
  });
  const joinedMessage = buildWorkspaceActionSuccessMessage({
    action: "join",
    role: "admin",
    addedAnotherWorkspace: true,
  });

  assert.match(createdMessage, /Workspace created/i);
  assert.match(createdMessage, /Owner access granted/i);
  assert.match(joinedMessage, /kept your other workspaces available/i);
  assert.match(buildWorkspaceRoleNote("admin"), /Operational control/i);
});

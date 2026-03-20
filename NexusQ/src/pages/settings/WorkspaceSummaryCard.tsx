import { Bell, Building2, KeyRound, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AccessRole } from "@/lib/access";
import { canManageWorkspaceAccess, getAccessRoleLabel, getAccessRoleSummary } from "@/lib/permissions";

type WorkspaceSummaryCardProps = {
  clientId: string | null;
  role: AccessRole | null;
  workspaceCount: number;
};

export function WorkspaceSummaryCard({ clientId, role, workspaceCount }: WorkspaceSummaryCardProps) {
  const navigate = useNavigate();
  const canManageAdmin = canManageWorkspaceAccess(role);
  const roleLabel = getAccessRoleLabel(role);
  const roleSummary = getAccessRoleSummary(role);

  return (
    <Card className="border-none bg-muted/20">
      <CardHeader>
        <CardTitle className="text-base">Workspace Context</CardTitle>
        <CardDescription>Current tenant scope, access posture, and shared operator surfaces.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-background p-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active Workspace</div>
            <div className="mt-2 text-sm font-semibold break-all">{clientId ?? "Not linked"}</div>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Access Role</div>
            <div className="mt-2 text-sm font-semibold">{roleLabel}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{roleSummary}</div>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Workspace Access</div>
            <div className="mt-2 text-sm font-semibold">{workspaceCount} linked workspace{workspaceCount === 1 ? "" : "s"}</div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Button variant="outline" className="h-11 justify-start gap-2" onClick={() => navigate("/notifications")}>
            <Bell className="h-4 w-4" />
            Open Notifications
          </Button>
          <Button variant="outline" className="h-11 justify-start gap-2" onClick={() => navigate("/link-workspace?mode=join")}>
            <UserPlus className="h-4 w-4" />
            Join Workspace
          </Button>
          <Button
            variant="outline"
            className="h-11 justify-start gap-2"
            disabled={!canManageAdmin}
            onClick={() => {
              document.getElementById("workspace-access-keys")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            {canManageAdmin ? <KeyRound className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
            {canManageAdmin ? "Manage Access Keys" : "Admin Access Required"}
          </Button>
        </div>

        {!canManageAdmin ? (
          <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
            Workspace key management is reserved for admins and owners. Viewer access keeps operational data visible without exposing workspace administration.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

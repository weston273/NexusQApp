import React from "react";
import { Building2, KeyRound, Sparkles } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthProvider";
import {
  createWorkspaceForCurrentUser,
  joinWorkspaceForCurrentUser,
  normalizeAccessKey,
  parseAccessError,
  setStoredActiveClientId,
} from "@/lib/access";
import { getErrorMessage } from "@/lib/errors";
import { getAccessRoleLabel, getAccessRoleSummary } from "@/lib/permissions";
import {
  buildWorkspaceActionSuccessMessage,
  buildWorkspaceRoleNote,
  getWorkspaceModeContent,
  type WorkspaceMode,
} from "@/features/workspace-linking/utils";

function defaultTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function LinkWorkspacePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, clientId, accessRows, role, refreshAccess } = useAuth();
  const [rawKey, setRawKey] = React.useState("");
  const [workspaceName, setWorkspaceName] = React.useState("");
  const [timezone, setTimezone] = React.useState(defaultTimezone());
  const [generateInitialKey, setGenerateInitialKey] = React.useState(false);
  const [loadingJoin, setLoadingJoin] = React.useState(false);
  const [loadingCreate, setLoadingCreate] = React.useState(false);
  const [joinError, setJoinError] = React.useState<string | null>(null);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [createdKey, setCreatedKey] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<WorkspaceMode>(() =>
    searchParams.get("mode") === "join" ? "join" : "create"
  );

  const hasExistingWorkspace = Boolean(clientId);
  const workspaceCount = accessRows.length;
  const createModeContent = React.useMemo(
    () => getWorkspaceModeContent("create", hasExistingWorkspace),
    [hasExistingWorkspace]
  );
  const joinModeContent = React.useMemo(
    () => getWorkspaceModeContent("join", hasExistingWorkspace),
    [hasExistingWorkspace]
  );
  const modeContent = React.useMemo(
    () => getWorkspaceModeContent(mode, hasExistingWorkspace),
    [hasExistingWorkspace, mode]
  );

  React.useEffect(() => {
    setMode(searchParams.get("mode") === "join" ? "join" : "create");
  }, [searchParams]);

  React.useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
    }
  }, [navigate, user]);

  const setModeInRoute = React.useCallback(
    (nextMode: WorkspaceMode) => {
      setMode(nextMode);
      setSearchParams({ mode: nextMode }, { replace: true });
    },
    [setSearchParams]
  );

  const onSubmitJoin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setJoinError(null);
    setLoadingJoin(true);

    try {
      const result = await joinWorkspaceForCurrentUser(normalizeAccessKey(rawKey));
      setStoredActiveClientId(result.client_id);
      await refreshAccess();
      toast.success(
        buildWorkspaceActionSuccessMessage({
          action: "join",
          role: result.role,
          addedAnotherWorkspace: hasExistingWorkspace,
        })
      );
      navigate("/", { replace: true });
    } catch (error: unknown) {
      setJoinError(parseAccessError(error instanceof Error ? error : new Error(getErrorMessage(error))));
    } finally {
      setLoadingJoin(false);
    }
  };

  const onSubmitCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);
    setLoadingCreate(true);

    try {
      const result = await createWorkspaceForCurrentUser({
        workspaceName,
        timezone,
        generateInitialKey,
      });
      setCreatedKey(result.access_key?.raw_key ?? null);
      setStoredActiveClientId(result.client_id);
      await refreshAccess();
      toast.success(
        buildWorkspaceActionSuccessMessage({
          action: "create",
          role: result.role,
          addedAnotherWorkspace: hasExistingWorkspace,
        })
      );
      if (!result.access_key?.raw_key) {
        navigate("/", { replace: true });
      }
    } catch (error: unknown) {
      setCreateError(parseAccessError(error instanceof Error ? error : new Error(getErrorMessage(error))));
    } finally {
      setLoadingCreate(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-8 flex items-center justify-center">
      <Card className="w-full max-w-3xl border-none card-surface-b">
        <CardHeader className="space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <CardTitle>{hasExistingWorkspace ? "Add or Create Workspace Access" : "Finish Workspace Setup"}</CardTitle>
              <CardDescription>
                {hasExistingWorkspace
                  ? "Use this account to join another workspace or create a new tenant without losing existing access."
                  : "Choose how this account should enter NexusQ: create a new workspace or join one with an access key."}
              </CardDescription>
            </div>

            {clientId ? (
              <div className="rounded-lg border bg-background px-3 py-2 text-right text-xs">
                <div className="font-semibold text-foreground">Current workspace</div>
                <div className="text-muted-foreground break-all">{clientId}</div>
                {role ? <div className="mt-1 text-muted-foreground">{buildWorkspaceRoleNote(role)}</div> : null}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setModeInRoute("create")}
              className={`rounded-xl border p-4 text-left transition-colors ${mode === "create" ? "border-primary bg-primary/5" : "bg-background hover:bg-muted/40"}`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="h-4 w-4 text-primary" />
                {createModeContent.title}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {createModeContent.description}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setModeInRoute("join")}
              className={`rounded-xl border p-4 text-left transition-colors ${mode === "join" ? "border-primary bg-primary/5" : "bg-background hover:bg-muted/40"}`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <KeyRound className="h-4 w-4 text-primary" />
                {joinModeContent.title}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {joinModeContent.description}
              </div>
            </button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-background/80 p-4">
            <div className="text-sm font-semibold">{modeContent.title}</div>
            <div className="mt-1 text-sm text-muted-foreground">{modeContent.description}</div>
            <div className="mt-2 text-xs text-muted-foreground">{modeContent.helper}</div>
          </div>

          {hasExistingWorkspace ? (
            <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">This account already has {workspaceCount} linked workspace{workspaceCount === 1 ? "" : "s"}.</div>
              <div className="mt-1">
                Creating or joining here will add another workspace to your switcher in the header. Your current access stays intact.
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">Signed in as {user?.email ?? "this operator"}.</div>
              <div className="mt-1">
                NexusQ needs one linked workspace before you can access the dashboard, pipeline, health, or notifications.
              </div>
            </div>
          )}

          {mode === "create" ? (
            <form className="space-y-4" onSubmit={onSubmitCreate}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="workspace-name">Workspace name</Label>
                  <Input
                    id="workspace-name"
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                    placeholder="Acme Services"
                    autoComplete="organization"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workspace-timezone">Timezone</Label>
                  <Input
                    id="workspace-timezone"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    placeholder="Africa/Harare"
                    required
                  />
                </div>

                <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
                  <div className="font-semibold text-foreground">Owner access</div>
                  <div className="mt-1">
                    Creating a workspace makes this account the initial {getAccessRoleLabel("owner").toLowerCase()}.
                  </div>
                  <div className="mt-1">{getAccessRoleSummary("owner")}</div>
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-lg border bg-background p-3 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={generateInitialKey}
                  onChange={(event) => setGenerateInitialKey(event.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium text-foreground">Generate an initial admin access key</span>
                  <span className="block mt-1">
                    Useful when another operator needs immediate admin access after the workspace is created. The raw key is shown once.
                  </span>
                </span>
              </label>

              {createError ? <p className="text-sm text-status-error">{createError}</p> : null}

              <div className="flex flex-wrap gap-3">
                {hasExistingWorkspace ? (
                  <Button type="button" variant="outline" onClick={() => navigate("/", { replace: true })}>
                    Back to workspace
                  </Button>
                ) : null}
                <Button type="submit" className="flex-1 min-w-[220px]" disabled={loadingCreate || !workspaceName.trim()}>
                  {loadingCreate ? "Creating workspace..." : modeContent.submitLabel}
                </Button>
              </div>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={onSubmitJoin}>
              <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">Need an access key?</div>
                <div className="mt-1">
                  Ask a workspace owner or admin to generate one from Settings. Keys are role-scoped and can be revoked without removing existing users.
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="access-key">Workspace access key</Label>
                <Input
                  id="access-key"
                  value={rawKey}
                  onChange={(event) => setRawKey(event.target.value)}
                  placeholder="NQ-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Keys are normalized as uppercase and validated securely through the workspace bootstrap function.
                </p>
              </div>

              {joinError ? <p className="text-sm text-status-error">{joinError}</p> : null}

              <div className="flex flex-wrap gap-3">
                {hasExistingWorkspace ? (
                  <Button type="button" variant="outline" onClick={() => navigate("/", { replace: true })}>
                    Back to workspace
                  </Button>
                ) : null}
                <Button type="submit" className="flex-1 min-w-[220px]" disabled={loadingJoin || !normalizeAccessKey(rawKey)}>
                  {loadingJoin ? "Linking workspace..." : modeContent.submitLabel}
                </Button>
              </div>
            </form>
          )}

          {createdKey ? (
            <div className="rounded-md border bg-background p-4 text-xs space-y-3">
              <div className="flex items-center gap-2 text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-semibold">Initial access key ready</span>
              </div>
              <div className="text-muted-foreground">
                This key grants {getAccessRoleLabel("admin").toLowerCase()} access and is shown only once.
              </div>
              <div className="font-mono break-all rounded-md border bg-muted/40 px-3 py-2">{createdKey}</div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(createdKey);
                      toast.success("Access key copied.");
                    } catch {
                      toast.error("Copy failed.");
                    }
                  }}
                >
                  Copy key
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    navigate("/", { replace: true });
                  }}
                >
                  Continue to workspace
                </Button>
              </div>
            </div>
          ) : null}

          <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
            Workspace creation and linking are handled through secure Supabase edge functions so the browser never needs to orchestrate tenancy changes directly.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

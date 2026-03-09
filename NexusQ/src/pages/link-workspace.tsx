import React from "react";
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
} from "@/lib/access";

type WorkspaceMode = "create" | "join";

function defaultTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function LinkWorkspacePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, clientId, refreshAccess } = useAuth();
  const [rawKey, setRawKey] = React.useState("");
  const [workspaceName, setWorkspaceName] = React.useState("");
  const [timezone, setTimezone] = React.useState(defaultTimezone());
  const [generateInitialKey, setGenerateInitialKey] = React.useState(false);
  const [loadingJoin, setLoadingJoin] = React.useState(false);
  const [loadingCreate, setLoadingCreate] = React.useState(false);
  const [joinError, setJoinError] = React.useState<string | null>(null);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [createdKey, setCreatedKey] = React.useState<string | null>(null);
  const [holdRedirectForKey, setHoldRedirectForKey] = React.useState(false);
  const [mode, setMode] = React.useState<WorkspaceMode>(() =>
    searchParams.get("mode") === "join" ? "join" : "create"
  );

  React.useEffect(() => {
    setMode(searchParams.get("mode") === "join" ? "join" : "create");
  }, [searchParams]);

  React.useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (clientId && mode === "create" && !holdRedirectForKey) {
      navigate("/", { replace: true });
    }
  }, [clientId, holdRedirectForKey, mode, navigate, user]);

  const onSubmitJoin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setJoinError(null);
    setLoadingJoin(true);

    try {
      const result = await joinWorkspaceForCurrentUser(normalizeAccessKey(rawKey));
      await refreshAccess();
      toast.success(`Workspace linked with role: ${result.role}`);
      navigate("/", { replace: true });
    } catch (error: any) {
      setJoinError(parseAccessError(error));
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
      if (result.access_key?.raw_key) {
        setCreatedKey(result.access_key.raw_key);
        setHoldRedirectForKey(true);
      } else {
        setCreatedKey(null);
        setHoldRedirectForKey(false);
      }
      await refreshAccess();
      toast.success(`Workspace created. Role: ${result.role}`);
      if (!result.access_key?.raw_key) {
        navigate("/", { replace: true });
      }
    } catch (error: any) {
      setCreateError(parseAccessError(error));
    } finally {
      setLoadingCreate(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-8 flex items-center justify-center">
      <Card className="w-full max-w-xl border-none card-surface-b">
        <CardHeader>
          <CardTitle>Workspace Setup</CardTitle>
          <CardDescription>
            Create a new workspace or join an existing one with an access key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button variant={mode === "create" ? "default" : "outline"} onClick={() => setMode("create")}>
              Create workspace
            </Button>
            <Button variant={mode === "join" ? "default" : "outline"} onClick={() => setMode("join")}>
              Join with key
            </Button>
          </div>

          {mode === "create" ? (
            <form className="space-y-4" onSubmit={onSubmitCreate}>
              <div className="space-y-2">
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

              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={generateInitialKey}
                  onChange={(event) => setGenerateInitialKey(event.target.checked)}
                />
                Generate an initial admin access key
              </label>

              {createError ? <p className="text-sm text-status-error">{createError}</p> : null}

              <Button type="submit" className="w-full" disabled={loadingCreate || !workspaceName.trim()}>
                {loadingCreate ? "Creating workspace..." : "Create workspace"}
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={onSubmitJoin}>
              {clientId ? (
                <div className="rounded-md border bg-background p-2 text-xs text-muted-foreground">
                  You are already linked to a workspace. This will add access to another workspace on this account.
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="access-key">Organization access key</Label>
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
                  Keys are normalized as uppercase and validated server-side.
                </p>
              </div>

              {joinError ? <p className="text-sm text-status-error">{joinError}</p> : null}

              <Button type="submit" className="w-full" disabled={loadingJoin || !normalizeAccessKey(rawKey)}>
                {loadingJoin ? "Linking workspace..." : "Join workspace"}
              </Button>
            </form>
          )}

          {createdKey ? (
            <div className="rounded-md border bg-background p-3 text-xs space-y-2">
              <div className="font-semibold">Initial access key (shown once)</div>
              <div className="font-mono break-all">{createdKey}</div>
              <div className="flex items-center gap-2">
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
                {clientId ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setHoldRedirectForKey(false);
                      navigate("/", { replace: true });
                    }}
                  >
                    Continue to workspace
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Workspace linking and creation are handled by server-side edge functions, not browser-side SQL orchestration.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

import React from "react";
import { AlertTriangle, KeyRound, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { GeneratedKeyModal } from "@/components/access/GeneratedKeyModal";
import {
  createClientAccessKey,
  listClientAccessKeys,
  parseAccessError,
  setClientAccessKeyActive,
} from "@/lib/access";
import type { AccessRole, ClientAccessKeyRow } from "@/lib/access";
import { getErrorMessage } from "@/lib/errors";
import {
  canCreateOwnerAccessKeys,
  canManageWorkspaceAccess,
  getAccessRoleLabel,
  getAccessRoleSummary,
} from "@/lib/permissions";

type AccessKeyFormProps = {
  clientId: string;
  role: AccessRole | null;
  accessLoading: boolean;
  sessionReady: boolean;
  profileReady: boolean;
  accessReady: boolean;
  userId: string | null;
  authError: string | null;
};

type CreateFormState = {
  label: string;
  role: AccessRole;
  expiresAt: string;
  isActive: boolean;
};

const initialFormState: CreateFormState = {
  label: "",
  role: "viewer",
  expiresAt: "",
  isActive: true,
};

function formatDateWithZone(iso: string | null) {
  if (!iso) return "Never";
  const date = new Date(iso);
  return `${date.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone}) | ${date.toUTCString()} UTC`;
}

function toIsoOrNull(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString();
}

function toLocalInputDate(isoDate: string) {
  const date = new Date(isoDate);
  const pad = (value: number) => String(value).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function defaultOwnerExpiryLocal() {
  return toLocalInputDate(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
}

export function AccessKeyForm({
  clientId,
  role,
  accessLoading,
  sessionReady,
  profileReady,
  accessReady,
  userId,
  authError,
}: AccessKeyFormProps) {
  const accessContextLoaded = sessionReady && profileReady && accessReady && !accessLoading;
  const roleKnown = role !== null;
  const canManage = accessContextLoaded && roleKnown && canManageWorkspaceAccess(role);
  const isOwner = canCreateOwnerAccessKeys(role);
  const allowedRoles = React.useMemo<AccessRole[]>(
    () => (isOwner ? ["viewer", "admin", "owner"] : ["viewer", "admin"]),
    [isOwner]
  );

  const [keys, setKeys] = React.useState<ClientAccessKeyRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<CreateFormState>(initialFormState);
  const [confirmOwnerKey, setConfirmOwnerKey] = React.useState(false);
  const [createdRawKey, setCreatedRawKey] = React.useState<string | null>(null);
  const [copiedConfirmed, setCopiedConfirmed] = React.useState(false);

  const loadKeys = React.useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    setError(null);

    const { data, error: listError } = await listClientAccessKeys(clientId);
    if (listError) {
      setError(parseAccessError(listError));
      setLoading(false);
      return;
    }

    setKeys(data ?? []);
    setLoading(false);
  }, [canManage, clientId]);

  React.useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  React.useEffect(() => {
    if (!allowedRoles.includes(form.role)) {
      setForm((prev) => ({ ...prev, role: allowedRoles[0] }));
    }
  }, [allowedRoles, form.role]);

  React.useEffect(() => {
    if (form.role !== "owner") {
      setConfirmOwnerKey(false);
      return;
    }
    if (!form.expiresAt) {
      setForm((prev) => ({ ...prev, expiresAt: defaultOwnerExpiryLocal() }));
    }
  }, [form.expiresAt, form.role]);

  const applySpecialPreset = (params: { role: AccessRole; label: string; expiresHours?: number }) => {
    const expiresAt =
      params.expiresHours != null
        ? toLocalInputDate(new Date(Date.now() + params.expiresHours * 60 * 60 * 1000).toISOString())
        : "";

    setForm((prev) => ({
      ...prev,
      label: params.label,
      role: params.role,
      expiresAt,
      isActive: true,
    }));
    setConfirmOwnerKey(false);
  };

  const onCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage || !roleKnown) return;

    if (form.role === "owner") {
      if (!isOwner) {
        setError("Only current owners can create owner access keys.");
        return;
      }
      if (!confirmOwnerKey) {
        setError("Confirm owner-level key creation before continuing.");
        return;
      }
      if (!form.expiresAt) {
        setError("Owner-level keys require an expiry.");
        return;
      }
    }

    setCreating(true);
    setError(null);

    try {
      const { rawKey } = await createClientAccessKey({
        clientId,
        label: form.label,
        role: form.role,
        isActive: form.isActive,
        expiresAt: toIsoOrNull(form.expiresAt),
        confirmOwnerKey: form.role === "owner" && confirmOwnerKey,
      });

      setCreatedRawKey(rawKey);
      setCopiedConfirmed(false);
      setForm({
        ...initialFormState,
        role: isOwner ? "admin" : "viewer",
      });
      setConfirmOwnerKey(false);
      toast.success("Access key created.");
      await loadKeys();
    } catch (createError: unknown) {
      setError(getErrorMessage(createError, "Failed to create access key."));
    } finally {
      setCreating(false);
    }
  };

  const onToggle = async (key: ClientAccessKeyRow, nextActive: boolean) => {
    if (!canManage) return;
    if (key.role === "owner" && !isOwner) {
      setError("Only owners can modify owner-level access keys.");
      return;
    }

    setError(null);
    try {
      await setClientAccessKeyActive(key.id, nextActive);
      toast.success(nextActive ? "Access key reactivated." : "Access key revoked.");
      await loadKeys();
    } catch (toggleError: unknown) {
      setError(getErrorMessage(toggleError, "Failed to update access key status."));
    }
  };

  const copyRawKey = async () => {
    if (!createdRawKey) return;
    try {
      await navigator.clipboard.writeText(createdRawKey);
      toast.success("Key copied.");
      setCopiedConfirmed(true);
    } catch {
      toast.error("Could not copy key.");
    }
  };

  if (!accessContextLoaded) {
    return (
      <Card className="border-none bg-muted/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Workspace Access Keys
          </CardTitle>
          <CardDescription>Loading session, profile, and workspace access context...</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <div>Session loaded: {sessionReady ? "yes" : "no"}</div>
          <div>Profile loaded: {profileReady ? "yes" : "no"}</div>
          <div>Workspace access loaded: {accessReady ? "yes" : "no"}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none bg-muted/20">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Workspace Access Keys
        </CardTitle>
        <CardDescription>
          Create and revoke organization access keys for linking users to this workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {import.meta.env.DEV ? (
          <div className="rounded-md border bg-background p-3 text-xs font-mono space-y-1">
            <div>Access Debug</div>
            <div>user_id: {userId || "none"}</div>
            <div>client_id: {clientId || "none"}</div>
            <div>role: {role || "unknown"}</div>
            <div>session_loaded: {String(sessionReady)}</div>
            <div>profile_loaded: {String(profileReady)}</div>
            <div>user_access_loaded: {String(accessReady)}</div>
            <div>last_error: {error || authError || "none"}</div>
          </div>
        ) : null}

        {!canManage ? (
          <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground space-y-2">
            <div className="font-medium text-foreground">
              {getAccessRoleLabel(role)} access does not include workspace key management.
            </div>
            <div>{getAccessRoleSummary(role)}</div>
            <div>Ask an owner or admin to create or revoke workspace access keys when you need to onboard another operator.</div>
          </div>
        ) : (
          <>
            <div className="rounded-md border bg-background p-3 space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Current access level
              </div>
              <div className="text-sm font-medium">{getAccessRoleLabel(role)}</div>
              <div className="text-xs text-muted-foreground">{getAccessRoleSummary(role)}</div>
            </div>

            {isOwner ? (
              <div className="rounded-md border bg-background p-3 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Owner Quick Actions
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      applySpecialPreset({
                        role: "admin",
                        label: "Core Admin Invite",
                        expiresHours: 72,
                      })
                    }
                  >
                    Create Special Admin Key
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      applySpecialPreset({
                        role: "owner",
                        label: "Co-Founder Invite",
                        expiresHours: 24,
                      })
                    }
                  >
                    Create Owner Bootstrap Key
                  </Button>
                </div>
              </div>
            ) : null}

            <form className="grid gap-3 md:grid-cols-2" onSubmit={onCreate}>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="key-label">Label</Label>
                <Input
                  id="key-label"
                  placeholder="e.g. Sales team onboarding"
                  value={form.label}
                  onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="key-role">Role</Label>
                <select
                  id="key-role"
                  value={form.role}
                  onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as AccessRole }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                  {isOwner ? <option value="owner">Owner</option> : null}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expires-at">
                  Expires at {form.role === "owner" ? "(required for owner key)" : "(optional)"}
                </Label>
                <Input
                  id="expires-at"
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
                  required={form.role === "owner"}
                />
                <p className="text-[11px] text-muted-foreground">Stored in UTC. Displayed in your local timezone and UTC.</p>
              </div>

              <label className="md:col-span-2 flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                Create as active key
              </label>

              {form.role === "owner" ? (
                <div className="md:col-span-2 rounded-md border border-status-warning/40 bg-status-warning/10 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-status-warning">
                    <AlertTriangle className="h-4 w-4" />
                    High-Privilege Key Warning
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Owner keys grant full workspace control. Default expiry is 24h; max allowed is 7 days.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Current owner-key expiry: {form.expiresAt ? formatDateWithZone(toIsoOrNull(form.expiresAt)) : "Not set"}
                  </p>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={confirmOwnerKey}
                      onChange={(event) => setConfirmOwnerKey(event.target.checked)}
                    />
                    I understand the risk and want to create an owner-level key.
                  </label>
                </div>
              ) : null}

              <Button type="submit" className="md:col-span-2" disabled={creating || !roleKnown}>
                {creating ? "Creating key..." : "Create access key"}
              </Button>
            </form>

            {error ? <p className="text-sm text-status-error">{error}</p> : null}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Existing keys</div>
                <Button size="sm" variant="outline" onClick={() => void loadKeys()} className="gap-2" disabled={loading}>
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
              </div>

              {loading ? (
                <div className="text-sm text-muted-foreground">Loading keys...</div>
              ) : keys.length ? (
                <div className="space-y-2">
                  {keys.map((key) => {
                    const ownerKeyLocked = key.role === "owner" && !canCreateOwnerAccessKeys(role);
                    const actionLabel = key.is_active ? "Deactivate" : "Reactivate";
                    return (
                      <div key={key.id} className="rounded-md border bg-background p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium">{key.label || "Untitled key"}</div>
                          <div className="flex items-center gap-2">
                            <Badge variant={key.is_active ? "outline" : "secondary"}>
                              {key.is_active ? "active" : "inactive"}
                            </Badge>
                            <Badge variant="secondary">{key.role}</Badge>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Created: {formatDateWithZone(key.created_at)} | Expires: {formatDateWithZone(key.expires_at)} | Created by:{" "}
                          {key.created_by || "Unknown"}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant={key.is_active ? "destructive" : "outline"}
                            onClick={() => void onToggle(key, !key.is_active)}
                            disabled={ownerKeyLocked}
                          >
                            {actionLabel}
                          </Button>
                          {ownerKeyLocked ? (
                            <span className="text-xs text-muted-foreground">
                              Owner-level keys can only be modified by an owner.
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-md border border-dashed bg-background p-3 text-sm text-muted-foreground space-y-1">
                  <div>No keys found for this workspace.</div>
                  <div>If you expected keys, verify role permissions and current workspace context.</div>
                </div>
              )}
            </div>

            <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
              Revoking a key prevents new users from claiming access. It does not remove access from already linked users.
            </div>
          </>
        )}
      </CardContent>

      <GeneratedKeyModal
        open={Boolean(createdRawKey)}
        rawKey={createdRawKey}
        onClose={() => {
          if (!copiedConfirmed) return;
          setCreatedRawKey(null);
          setCopiedConfirmed(false);
        }}
        onCopy={copyRawKey}
        copiedConfirmed={copiedConfirmed}
        onCopiedConfirmedChange={setCopiedConfirmed}
      />
    </Card>
  );
}

import React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthProvider";
import { claimWorkspaceAccess, normalizeAccessKey, parseAccessError } from "@/lib/access";

export function LinkWorkspacePage() {
  const navigate = useNavigate();
  const { user, clientId, refreshAccess } = useAuth();
  const [rawKey, setRawKey] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (clientId) {
      navigate("/", { replace: true });
    }
  }, [clientId, navigate, user]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await claimWorkspaceAccess(normalizeAccessKey(rawKey));
      await refreshAccess();
      toast.success(`Workspace linked with role: ${result.role}`);
      navigate("/", { replace: true });
    } catch (claimError: any) {
      setError(parseAccessError(claimError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-8 flex items-center justify-center">
      <Card className="w-full max-w-lg border-none card-surface-b">
        <CardHeader>
          <CardTitle>Link Your Workspace</CardTitle>
          <CardDescription>
            Your account is authenticated but not linked to a client workspace yet. Enter your organization access key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={onSubmit}>
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
                Keys are normalized as uppercase and trimmed before secure verification.
              </p>
            </div>

            {error ? <p className="text-sm text-status-error">{error}</p> : null}

            <Button type="submit" className="w-full" disabled={loading || !normalizeAccessKey(rawKey)}>
              {loading ? "Linking workspace..." : "Link workspace"}
            </Button>
          </form>

          <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground space-y-1">
            <div>Authenticated but not linked yet? This is expected until you claim a workspace key.</div>
            <div>First owner bootstrap users may need admin SQL linking before this step is available.</div>
          </div>

          <p className="text-xs text-muted-foreground">
            Access keys are validated server-side via Supabase RPC and only create active links through `public.user_access`.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

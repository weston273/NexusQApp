import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exchangeOAuthCodeForSession } from "@/lib/auth";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const finishAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (!code) {
        navigate("/", { replace: true });
        return;
      }

      const { error: exchangeError } = await exchangeOAuthCodeForSession(code);
      if (exchangeError) {
        setError(exchangeError.message);
        return;
      }

      navigate("/", { replace: true });
    };

    void finishAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-8 flex items-center justify-center">
      <Card className="w-full max-w-md border-none card-surface-c">
        <CardHeader>
          <CardTitle>Completing sign in</CardTitle>
          <CardDescription>Finalizing OAuth session with Supabase.</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-status-error">{error}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Please wait while we complete authentication...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

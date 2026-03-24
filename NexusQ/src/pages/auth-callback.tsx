import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureLiveSession, exchangeOAuthCodeForSession } from "@/lib/auth";
import { clearPendingSignupPhone, persistCurrentUserPhone, readPendingSignupPhone, readUserMetadataPhone } from "@/lib/profile-contact";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const finishAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const errorCode = params.get("error");
      const errorDescription = params.get("error_description");
      if (errorCode) {
        setError(errorDescription || errorCode);
        return;
      }
      const code = params.get("code");
      if (!code) {
        navigate("/", { replace: true });
        return;
      }

      const { data, error: exchangeError } = await exchangeOAuthCodeForSession(code);
      if (exchangeError) {
        setError(exchangeError.message);
        return;
      }

      try {
        await ensureLiveSession(data.session, { clearInvalidSession: true });
      } catch (sessionError) {
        setError(sessionError instanceof Error ? sessionError.message : "Unable to complete sign in.");
        return;
      }

      try {
        const metadataPhone = readUserMetadataPhone(data.session.user);
        if (metadataPhone) {
          clearPendingSignupPhone();
        } else {
          const pendingPhone = readPendingSignupPhone();
          if (pendingPhone) {
            await persistCurrentUserPhone(pendingPhone, data.session.user);
            clearPendingSignupPhone();
          }
        }
      } catch (phoneError) {
        const message =
          phoneError instanceof Error ? phoneError.message : "Unable to save your operator phone number automatically.";
        setError(message);
        navigate("/complete-profile", { replace: true, state: { from: "/" } });
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

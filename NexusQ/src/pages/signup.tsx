import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ensureLiveSession, signInWithGoogleOAuth, signUpWithEmail } from "@/lib/auth";
import { normalizeE164PhoneInput } from "@/lib/phone";
import { clearPendingSignupPhone, persistCurrentUserPhone, storePendingSignupPhone } from "@/lib/profile-contact";

export function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearPendingSignupPhone();
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    const normalizedPhone = normalizeE164PhoneInput(phone);
    if (!normalizedPhone) {
      setError("Enter a valid phone number in E.164 format, for example +15551234567.");
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await signUpWithEmail({
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      phone: normalizedPhone,
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      try {
        await ensureLiveSession(data.session, { clearInvalidSession: true });
        await persistCurrentUserPhone(normalizedPhone, data.session.user);
      } catch (sessionError) {
        setError(sessionError instanceof Error ? sessionError.message : "Unable to finish sign up.");
        return;
      }
      toast.success("Account created.");
      navigate("/link-workspace?mode=create", { replace: true });
      return;
    }

    setMessage("Account created. Confirm your email, then sign in to create or join a workspace.");
  };

  const onGoogle = async () => {
    const normalizedPhone = normalizeE164PhoneInput(phone);
    if (!normalizedPhone) {
      setError("Enter a valid phone number before continuing with Google.");
      return;
    }

    setLoading(true);
    setError(null);
    clearPendingSignupPhone();
    storePendingSignupPhone(normalizedPhone);
    const { error: oauthError } = await signInWithGoogleOAuth();
    if (oauthError) {
      setError(oauthError.message);
      clearPendingSignupPhone();
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-8 flex items-center justify-center">
      <Card className="w-full max-w-md border-none card-surface-a">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>
            Sign up with email/password or continue with Google. After account creation, you will create or join a workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="full-name">Full name</Label>
              <Input
                id="full-name"
                autoComplete="name"
                placeholder="Jane Smith"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+15551234567"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Required for operator SMS alerts. Use E.164 format.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </div>

            {error ? <p className="text-sm text-status-error">{error}</p> : null}
            {message ? <p className="text-sm text-status-success">{message}</p> : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Sign up"}
            </Button>
          </form>

          <Button type="button" variant="outline" className="w-full" onClick={onGoogle} disabled={loading}>
            Continue with Google
          </Button>

          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link className="text-primary hover:underline" to="/login">
              Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

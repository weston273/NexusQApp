import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthProvider";
import { normalizeE164PhoneInput } from "@/lib/phone";
import { clearPendingSignupPhone, persistCurrentUserPhone, readPendingSignupPhone } from "@/lib/profile-contact";

export function CompleteProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clientId, phone } = useAuth();
  const [phoneInput, setPhoneInput] = React.useState(phone ?? readPendingSignupPhone() ?? "");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const from = (location.state as { from?: string } | undefined)?.from;

  React.useEffect(() => {
    if (phone) {
      setPhoneInput(phone);
    }
  }, [phone]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const normalized = normalizeE164PhoneInput(phoneInput);
    if (!normalized) {
      setError("Enter a valid phone number in E.164 format, for example +15551234567.");
      return;
    }

    setLoading(true);
    try {
      await persistCurrentUserPhone(normalized, user);
      clearPendingSignupPhone();
      toast.success("Operator phone number saved.");
      navigate(clientId ? from ?? "/" : "/link-workspace", { replace: true });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your operator phone number.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-8 flex items-center justify-center">
      <Card className="w-full max-w-md border-none card-surface-c">
        <CardHeader>
          <CardTitle>Complete your operator profile</CardTitle>
          <CardDescription>
            NexusQ now requires an operator phone number so alerts can reach the right person by SMS when needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="operator-phone">Phone number</Label>
              <Input
                id="operator-phone"
                type="tel"
                autoComplete="tel"
                placeholder="+15551234567"
                value={phoneInput}
                onChange={(event) => setPhoneInput(event.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Use E.164 format. Example: <span className="font-mono">+15551234567</span>
              </p>
            </div>

            {error ? <p className="text-sm text-status-error">{error}</p> : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving phone number..." : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

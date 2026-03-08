import { AccessKeyForm } from "@/components/access/AccessKeyForm";
import type { AccessRole } from "@/lib/access";

export function WorkspaceAccessKeys({
  clientId,
  role,
  accessLoading,
  sessionReady,
  profileReady,
  accessReady,
  userId,
  authError,
}: {
  clientId: string;
  role: AccessRole | null;
  accessLoading: boolean;
  sessionReady: boolean;
  profileReady: boolean;
  accessReady: boolean;
  userId: string | null;
  authError: string | null;
}) {
  return (
    <AccessKeyForm
      clientId={clientId}
      role={role}
      accessLoading={accessLoading}
      sessionReady={sessionReady}
      profileReady={profileReady}
      accessReady={accessReady}
      userId={userId}
      authError={authError}
    />
  );
}

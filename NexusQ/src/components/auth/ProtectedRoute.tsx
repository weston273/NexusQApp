import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { PageErrorState, PageLoadingState } from "@/components/ui/data-state";
import { useAuth } from "@/context/AuthProvider";

export function ProtectedRoute({
  children,
  requireLinkedClient = true,
  requirePhone = true,
}: {
  children: React.ReactElement;
  requireLinkedClient?: boolean;
  requirePhone?: boolean;
}) {
  const location = useLocation();
  const { loading, user, clientId, phoneReady, authError, refreshAccess } = useAuth();

  if (loading) {
    return <PageLoadingState title="Loading session" description="Checking authentication and workspace access." cardCount={2} />;
  }

  if (authError && user) {
    return (
      <PageErrorState
        title="Unable to verify workspace access"
        message={`${authError} Retry to refresh your linked workspace data.`}
        onRetry={() => {
          void refreshAccess();
        }}
      />
    );
  }

  if (authError && !user) {
    return (
      <PageErrorState
        title="Unable to restore your session"
        message={`${authError} Reload NexusQ and try again.`}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (requirePhone && !phoneReady) {
    return <Navigate to="/complete-profile" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (requireLinkedClient && !clientId) {
    return <Navigate to="/link-workspace" replace />;
  }

  return children;
}

export function PublicOnlyRoute({ children }: { children: React.ReactElement }) {
  const { loading, user, clientId, phoneReady, authError } = useAuth();

  if (loading) {
    return <PageLoadingState title="Loading session" description="Checking authentication state." cardCount={2} />;
  }

  if (authError && !user) {
    return (
      <PageErrorState
        title="Authentication service unavailable"
        message={`${authError} Reload the app before trying to sign in again.`}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!user) return children;
  if (!phoneReady) return <Navigate to="/complete-profile" replace />;
  if (!clientId) return <Navigate to="/link-workspace" replace />;
  return <Navigate to="/" replace />;
}

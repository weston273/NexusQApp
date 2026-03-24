import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { PageErrorState, PageLoadingState } from "@/components/ui/data-state";
import { useAuth } from "@/context/AuthProvider";

export function AuthGuard({ children }: { children: React.ReactElement }) {
  const location = useLocation();
  const { loading, user, clientId, phoneReady, authError, refreshAccess } = useAuth();

  if (loading) {
    return (
      <PageLoadingState
        title="Preparing your workspace"
        description="Restoring session and checking linked client access."
        cardCount={3}
      />
    );
  }

  if (authError && user) {
    return (
      <PageErrorState
        title="Unable to verify workspace access"
        message={`${authError} Retry to restore your linked workspace context.`}
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
        message={`${authError} Reload NexusQ and try signing in again.`}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (!phoneReady) {
    return <Navigate to="/complete-profile" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (!clientId) {
    return <Navigate to="/link-workspace" replace />;
  }

  return children;
}

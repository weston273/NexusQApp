import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { PageLoadingState } from "@/components/ui/data-state";
import { useAuth } from "@/context/AuthProvider";

export function AuthGuard({ children }: { children: React.ReactElement }) {
  const location = useLocation();
  const { loading, user, clientId } = useAuth();

  if (loading) {
    return (
      <PageLoadingState
        title="Preparing your workspace"
        description="Restoring session and checking linked client access."
        cardCount={3}
      />
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (!clientId) {
    return <Navigate to="/link-workspace" replace />;
  }

  return children;
}

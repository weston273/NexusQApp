import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { PageLoadingState } from "@/components/ui/data-state";
import { useAuth } from "@/context/AuthProvider";

export function ProtectedRoute({
  children,
  requireLinkedClient = true,
}: {
  children: React.ReactElement;
  requireLinkedClient?: boolean;
}) {
  const location = useLocation();
  const { loading, user, clientId } = useAuth();

  if (loading) {
    return <PageLoadingState title="Loading session" description="Checking authentication and workspace access." cardCount={2} />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (requireLinkedClient && !clientId) {
    return <Navigate to="/link-workspace" replace />;
  }

  return children;
}

export function PublicOnlyRoute({ children }: { children: React.ReactElement }) {
  const { loading, user, clientId } = useAuth();

  if (loading) {
    return <PageLoadingState title="Loading session" description="Checking authentication state." cardCount={2} />;
  }

  if (!user) return children;
  if (!clientId) return <Navigate to="/link-workspace" replace />;
  return <Navigate to="/" replace />;
}

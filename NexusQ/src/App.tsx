import React from "react";
import { Route, Routes } from "react-router-dom";
import { Shell } from "@/components/layout/shell";
import { Toaster } from "@/components/ui/sonner";
import AnimatedRoutes from "@/components/layout/AnimatedRoutes";
import RouteProgress from "@/components/layout/RouteProgress";
import { AppErrorBoundary } from "@/components/layout/AppErrorBoundary";
import { trackTelemetry } from "@/lib/telemetry";
import { AuthProvider } from "@/context/AuthProvider";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ProtectedRoute, PublicOnlyRoute } from "@/components/auth/ProtectedRoute";
import { LoginPage } from "@/pages/login";
import { SignupPage } from "@/pages/signup";
import { ForgotPasswordPage } from "@/pages/forgot-password";
import { LinkWorkspacePage } from "@/pages/link-workspace";
import { AuthCallbackPage } from "@/pages/auth-callback";
import { ResetPasswordPage } from "@/pages/reset-password";
import { CompleteProfilePage } from "@/pages/complete-profile";

function AppShell() {
  return (
    <Shell>
      <AnimatedRoutes />
    </Shell>
  );
}

function App() {
  React.useEffect(() => {
    const onError = (event: ErrorEvent) => {
      trackTelemetry({ type: "error", message: event.message, meta: { source: "window.error" } });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      trackTelemetry({ type: "error", message: String(event.reason), meta: { source: "window.unhandledrejection" } });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <AuthProvider>
      <AppErrorBoundary>
        <RouteProgress />
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicOnlyRoute>
                <SignupPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicOnlyRoute>
                <ForgotPasswordPage />
              </PublicOnlyRoute>
            }
          />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/complete-profile"
            element={
              <ProtectedRoute requireLinkedClient={false} requirePhone={false}>
                <CompleteProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/link-workspace"
            element={
              <ProtectedRoute requireLinkedClient={false}>
                <LinkWorkspacePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/*"
            element={
              <AuthGuard>
                <AppShell />
              </AuthGuard>
            }
          />
        </Routes>
      </AppErrorBoundary>
      <Toaster />
    </AuthProvider>
  );
}

export default App;

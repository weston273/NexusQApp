import React from "react";
// import { Routes, Route } from 'react-router-dom';
import { Shell } from '@/components/layout/shell';
import { SplashGate } from "@/components/splash/SplashGate";
// import { Dashboard } from '@/pages/dashboard';
// import { Pipeline } from '@/pages/pipeline';
// import { LeadIntake } from '@/pages/intake';
// import { Health } from '@/pages/health';
import { Toaster } from '@/components/ui/sonner';
import AnimatedRoutes from "@/components/layout/AnimatedRoutes";
import RouteProgress from "@/components/layout/RouteProgress";
import { AppErrorBoundary } from "@/components/layout/AppErrorBoundary";
import { trackTelemetry } from "@/lib/telemetry";


import { useLeads } from '@/hooks/useLeads';



function App() {

  const { loading, error, reload } = useLeads();

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
    <>
      <AppErrorBoundary>
        <SplashGate
          ready={!loading && !error}
          error={error}
          onRetry={() => {
            void reload();
          }}
        >
          <RouteProgress />
          <Shell>
            <AnimatedRoutes />
          </Shell>
        </SplashGate>
      </AppErrorBoundary>
      <Toaster />
    </>
  );
}

export default App;

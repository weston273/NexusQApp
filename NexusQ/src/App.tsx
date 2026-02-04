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


import { useLeads } from '@/hooks/useLeads';



function App() {

  const { loading } = useLeads();

  return (
    <>
      <SplashGate ready={!loading}>
        <RouteProgress />
      <Shell>
        <AnimatedRoutes />
      </Shell>
      </SplashGate>
      <Toaster />
    </>
  );
}

export default App;

import { Routes, Route } from 'react-router-dom';
import { Shell } from '@/components/layout/shell';
import { SplashGate } from "@/components/splash/SplashGate";
import { Dashboard } from '@/pages/dashboard';
import { Pipeline } from '@/pages/pipeline';
import { LeadIntake } from '@/pages/intake';
import { Health } from '@/pages/health';
import { Toaster } from '@/components/ui/sonner';

import { useLeads } from '@/hooks/useLeads';



function App() {

  const { loading } = useLeads();
  
  return (
    <>
      <SplashGate ready={!loading}>
      <Shell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/intake" element={<LeadIntake />} />
          <Route path="/health" element={<Health />} />
          <Route path="/settings" element={<div className="p-8 text-center text-muted-foreground">Settings module under development.</div>} />
        </Routes>
      </Shell>
      </SplashGate>
      <Toaster />
    </>
  );
}

export default App;

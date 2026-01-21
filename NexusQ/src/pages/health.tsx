import { 
  ShieldCheck, 
  Cpu, 
  Globe, 
  Database, 
  Activity,
  Zap,
  Server,
  Cloud,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const services = [
  { name: 'LLM Processor', status: 'optimal', load: 12, uptime: '99.98%', icon: Cpu },
  { name: 'Lead Validator', status: 'active', load: 5, uptime: '100%', icon: ShieldCheck },
  { name: 'Revenue Pipeline', status: 'synced', load: 8, uptime: '99.95%', icon: Database },
  { name: 'Messaging API', status: 'connected', load: 2, uptime: '99.99%', icon: Globe },
];

const logs = [
  { time: '05:12:44', event: 'Lead qualification completed', source: 'Nexus Core', status: 'success' },
  { time: '05:10:02', event: 'Automated response dispatched', source: 'Messaging', status: 'success' },
  { time: '05:08:15', event: 'System health check initiated', source: 'Monitor', status: 'info' },
  { time: '04:55:30', event: 'New intake request detected', source: 'Web Entry', status: 'success' },
  { time: '04:42:11', event: 'Minor latency detected in region us-east-1', source: 'Network', status: 'warning' },
];

export function Health() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">System Health</h1>
          <p className="text-muted-foreground mt-1">Operational status of Nexus Q automation layers.</p>
        </div>
        <div className="flex items-center gap-2 bg-status-success/10 text-status-success px-4 py-2 rounded-full border border-status-success/20">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wider">All Systems Nominal</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {services.map((service) => (
          <Card key={service.name} className="border-none bg-muted/30">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center border">
                  <service.icon className="h-5 w-5 text-primary" />
                </div>
                <Badge variant="outline" className="text-[9px] font-bold uppercase">
                  {service.status}
                </Badge>
              </div>
              <div>
                <div className="text-sm font-bold">{service.name}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Uptime: {service.uptime}</div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="opacity-60 uppercase">Load</span>
                  <span>{service.load}%</span>
                </div>
                <Progress value={service.load} className="h-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none bg-muted/10">
          <CardHeader>
            <CardTitle className="text-lg">Real-time Activity Log</CardTitle>
            <CardDescription>Event stream from autonomous agents.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-0 font-mono text-xs">
              {logs.map((log, i) => (
                <div key={i} className="flex items-start gap-4 py-3 border-b border-border/50 last:border-0">
                  <span className="text-muted-foreground/60 w-20 flex-shrink-0">{log.time}</span>
                  <div className="flex-1 flex items-center gap-2">
                    {log.status === 'success' ? <div className="h-1.5 w-1.5 rounded-full bg-status-success" /> : 
                     log.status === 'warning' ? <AlertTriangle className="h-3 w-3 text-status-warning" /> : 
                     <div className="h-1.5 w-1.5 rounded-full bg-status-info" />}
                    <span>{log.event}</span>
                  </div>
                  <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-widest h-5 px-1.5 bg-background border">
                    {log.source}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none bg-muted/30">
            <CardHeader>
              <CardTitle className="text-lg">Network Map</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center justify-center py-6 space-y-4">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full border-2 border-dashed border-primary/20 animate-spin-slow" />
                  <Server className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-primary" />
                </div>
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <Cloud className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[10px] mt-1 font-bold">AWS</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[10px] mt-1 font-bold">Edge</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[10px] mt-1 font-bold">CDN</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none bg-primary text-primary-foreground">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="h-5 w-5" />
                <span className="font-bold">Security & Compliance</span>
              </div>
              <p className="text-xs opacity-70 mb-4">
                All lead data is encrypted at rest and in transit. Nexus Q adheres to SOC2 and GDPR principles for home service operations.
              </p>
              <div className="flex items-center justify-between text-[10px] font-bold border-t border-white/10 pt-4">
                <span className="opacity-60">Last Audit</span>
                <span>Today, 04:00 AM</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

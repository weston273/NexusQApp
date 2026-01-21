import { 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Clock, 
  ArrowRight,
  PhoneCall,
  CalendarCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const stats = [
  { label: 'Leads Captured', value: '42', change: '+12%', icon: Users },
  { label: 'Avg. Response', value: '< 2m', change: '-15%', icon: Clock },
  { label: 'Conversion', value: '68%', change: '+5%', icon: TrendingUp },
  { label: 'Open Intents', value: '18', change: 'Stable', icon: MessageSquare },
];

const recentActivity = [
  { id: 1, type: 'lead', user: 'James Wilson', action: 'Requested Quote', time: '2m ago', status: 'Qualifying' },
  { id: 2, type: 'booking', user: 'Sarah Miller', action: 'Booked Service', time: '15m ago', status: 'Confirmed' },
  { id: 3, type: 'followup', user: 'Mike Brown', action: 'Pending Follow-up', time: '1h ago', status: 'Urgent' },
];

export function Dashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Command Center</h1>
        <p className="text-muted-foreground mt-1">Real-time revenue operations and system health.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-none bg-muted/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                  {stat.label}
                </p>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className={cn(
                  "text-[10px] font-bold",
                  stat.change.startsWith('+') ? "text-status-success" : stat.change.startsWith('-') ? "text-status-info" : "text-muted-foreground"
                )}>
                  {stat.change}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none bg-muted/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Lead Activity</CardTitle>
              <CardDescription>Latest interactions across all channels.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-xs gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between border-b border-border/50 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center border">
                      {activity.type === 'lead' ? <Users className="h-5 w-5" /> : 
                       activity.type === 'booking' ? <CalendarCheck className="h-5 w-5" /> : 
                       <PhoneCall className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold">{activity.user}</div>
                      <div className="text-xs text-muted-foreground">{activity.action}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tighter">
                      {activity.status}
                    </Badge>
                    <div className="text-[10px] text-muted-foreground mt-1">{activity.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-primary text-primary-foreground">
          <CardHeader>
            <CardTitle className="text-lg">System Intelligence</CardTitle>
            <CardDescription className="text-primary-foreground/60">
              Nexus Q active automation insights.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-background/10 p-4 border border-white/10">
              <div className="text-xs font-bold uppercase tracking-wider mb-2">Next Suggested Action</div>
              <p className="text-sm">3 leads are awaiting follow-up for HVAC service. High conversion probability identified.</p>
              <Button className="w-full mt-4 bg-white text-black hover:bg-white/90 text-xs font-bold">
                Run Follow-up Flow
              </Button>
            </div>
            
            <div className="flex items-center justify-between text-xs px-2">
              <span className="opacity-60">LLM Processing Status</span>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                <span>Optimized</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
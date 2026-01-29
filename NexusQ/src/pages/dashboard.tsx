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
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

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

const leadTrend = [
  { day: 'Mon', leads: 8 },
  { day: 'Tue', leads: 12 },
  { day: 'Wed', leads: 10 },
  { day: 'Thu', leads: 15 },
  { day: 'Fri', leads: 20 },
  { day: 'Sat', leads: 18 },
  { day: 'Sun', leads: 22 },
];

const funnelData = [
  { stage: 'Leads', value: 42 },
  { stage: 'Contacted', value: 35 },
  { stage: 'Qualified', value: 24 },
  { stage: 'Converted', value: 17 },
];

const responseData = [
  { period: 'Yesterday', time: 3.2 },
  { period: 'Today', time: 1.8 },
];

const activityData = [
  { name: 'Leads', value: 42 },
  { name: 'Bookings', value: 18 },
  { name: 'Follow-ups', value: 12 },
];

function LeadTrendChart() {
  return (
    <div className="h-[240px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={leadTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.1} />
          <XAxis 
            dataKey="day" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))', 
              borderColor: 'hsl(var(--border))', 
              borderRadius: '8px',
              fontSize: '12px'
            }} 
          />
          <Area 
            type="monotone" 
            dataKey="leads" 
            stroke="hsl(var(--primary))" 
            strokeWidth={2} 
            fillOpacity={1} 
            fill="url(#colorLeads)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ConversionFunnel() {
  return (
    <div className="h-[200px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--muted-foreground))" opacity={0.1} />
          <XAxis type="number" hide />
          <YAxis 
            dataKey="stage" 
            type="category" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))', 
              borderColor: 'hsl(var(--border))', 
              borderRadius: '8px',
              fontSize: '12px'
            }} 
          />
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ResponseBarChart() {
  return (
    <div className="h-[200px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={responseData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.1} />
          <XAxis 
            dataKey="period" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))', 
              borderColor: 'hsl(var(--border))', 
              borderRadius: '8px',
              fontSize: '12px'
            }} 
          />
          <Bar dataKey="time" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} barSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ActivityPieChart() {
  const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--muted-foreground))'];
  return (
    <div className="h-[200px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={activityData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {activityData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))', 
              borderColor: 'hsl(var(--border))', 
              borderRadius: '8px',
              fontSize: '12px'
            }} 
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Dashboard() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Command Center</h1>
        <p className="text-muted-foreground mt-1">Real-time revenue operations and system health.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-2 border-none bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg">Lead Volume Trend</CardTitle>
            <CardDescription>Leads captured over the last 7 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <LeadTrendChart />
          </CardContent>
        </Card>

        <div className="lg:col-span-2 grid gap-4 md:grid-cols-2">
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
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-none bg-muted/20">
          <CardHeader>
            <CardTitle className="text-base">Conversion Pipeline</CardTitle>
            <CardDescription>Where leads progress or drop off.</CardDescription>
          </CardHeader>
          <CardContent>
            <ConversionFunnel />
          </CardContent>
        </Card>

        <Card className="border-none bg-muted/20">
          <CardHeader>
            <CardTitle className="text-base">Response Speed</CardTitle>
            <CardDescription>Average minutes to respond.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponseBarChart />
          </CardContent>
        </Card>

        <Card className="border-none bg-muted/20">
          <CardHeader>
            <CardTitle className="text-base">Interaction Breakdown</CardTitle>
            <CardDescription>Activity distribution across channels.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityPieChart />
          </CardContent>
        </Card>
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

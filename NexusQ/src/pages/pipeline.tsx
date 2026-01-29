import React from 'react';
import { 
  BarChart as ReBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  Users, 
  TrendingUp, 
  ArrowRight,
  MoreVertical,
  Plus,
  DollarSign,
  Zap,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

// --- DATA STRUCTURES ---

const stageDistribution = [
  { stage: 'New', count: 2 },
  { stage: 'Qualifying', count: 1 },
  { stage: 'Quoted', count: 2 },
  { stage: 'Booked', count: 1 },
];

const revenueData = [
  { stage: 'New', revenue: 430 },
  { stage: 'Qualifying', revenue: 1200 },
  { stage: 'Quoted', revenue: 3950 },
  { stage: 'Booked', revenue: 600 },
];

const pipelineFlow = [
  { stage: 'New Leads', value: 6 },
  { stage: 'Qualifying', value: 4 },
  { stage: 'Quoted', value: 3 },
  { stage: 'Booked', value: 1 },
];

const stages = [
  { id: 'new', title: 'New', color: 'bg-blue-500' },
  { id: 'qualifying', title: 'Qualifying', color: 'bg-amber-500' },
  { id: 'quoted', title: 'Quoted', color: 'bg-purple-500' },
  { id: 'booked', title: 'Booked', color: 'bg-emerald-500' },
];

const leads = [
  { id: 1, name: 'James Wilson', company: 'TechFlow Inc', value: '$430', time: '2h ago', stage: 'new' },
  { id: 2, name: 'Sarah Miller', company: 'Elite Services', value: '$1,200', time: '5h ago', stage: 'qualifying' },
  { id: 3, name: 'Mike Brown', company: 'Global Logistics', value: '$2,100', time: '1d ago', stage: 'quoted' },
  { id: 4, name: 'Emma Davis', company: 'Summit Partners', value: '$1,850', time: '2d ago', stage: 'quoted' },
  { id: 5, name: 'Robert Chen', company: 'Nexus Solutions', value: '$600', time: '3d ago', stage: 'booked' },
  { id: 6, name: 'Anna White', company: 'Cloud Nine', value: '$0', time: '10m ago', stage: 'new' },
];

// --- CHART COMPONENTS ---

const StageDistributionChart = () => (
  <Card className="border-none bg-muted/30">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium">Leads per Stage</CardTitle>
      <CardDescription className="text-xs">Where workload is concentrated.</CardDescription>
    </CardHeader>
    <CardContent className="h-[200px] pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart data={stageDistribution} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground) / 0.1)" />
          <XAxis 
            dataKey="stage" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
            itemStyle={{ color: 'hsl(var(--primary))' }}
          />
          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={30} />
        </ReBarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

const RevenueStageChart = () => (
  <Card className="border-none bg-muted/30">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium">Revenue Distribution</CardTitle>
      <CardDescription className="text-xs">Dollar value across pipeline.</CardDescription>
    </CardHeader>
    <CardContent className="h-[200px] pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart data={revenueData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground) / 0.1)" />
          <XAxis 
            dataKey="stage" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
            itemStyle={{ color: 'hsl(var(--primary))' }}
            formatter={(value) => [`$${value}`, 'Revenue']}
          />
          <Bar dataKey="revenue" radius={[4, 4, 0, 0]} barSize={30}>
            {revenueData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={index === 2 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.4)'} />
            ))}
          </Bar>
        </ReBarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

const PipelineFlowChart = () => (
  <Card className="border-none bg-muted/30">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium">Pipeline Progression</CardTitle>
      <CardDescription className="text-xs">How leads narrow toward bookings.</CardDescription>
    </CardHeader>
    <CardContent className="h-[200px] pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart data={pipelineFlow} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--muted-foreground) / 0.1)" />
          <XAxis type="number" hide />
          <YAxis 
            dataKey="stage" 
            type="category" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
            itemStyle={{ color: 'hsl(var(--primary))' }}
          />
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
        </ReBarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

// --- MAIN PAGE ---

export function Pipeline() {
  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline Operations</h1>
          <p className="text-muted-foreground mt-1 text-sm">Revenue flow and lead progression across all stages.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <Button size="sm" className="h-9 gap-2">
            <Plus className="h-4 w-4" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* NEW ANALYTICS ROW */}
      <div className="grid gap-6 md:grid-cols-3">
        <StageDistributionChart />
        <RevenueStageChart />
        <PipelineFlowChart />
      </div>

      {/* KANBAN BOARD */}
      <ScrollArea className="w-full whitespace-nowrap rounded-md border-none">
        <div className="flex w-max space-x-6 min-h-[600px]">
          {stages.map((stage) => (
            <div key={stage.id} className="w-[300px] flex flex-col space-y-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <div className={cn("h-2 w-2 rounded-full", stage.color)} />
                  <h3 className="font-bold text-sm uppercase tracking-wider">{stage.title}</h3>
                  <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5 bg-muted/50 text-muted-foreground">
                    {leads.filter(l => l.stage === stage.id).length}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>

              <div className="space-y-3">
                {leads.filter(l => l.stage === stage.id).map((lead) => (
                  <Card key={lead.id} className="border-none shadow-sm hover:shadow-md transition-shadow group cursor-pointer bg-muted/10">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-bold leading-none mb-1">{lead.name}</div>
                          <div className="text-[10px] text-muted-foreground font-medium">{lead.company}</div>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold h-5 bg-background border-border/50">
                          {lead.value}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/10">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                          <Zap className="h-3 w-3 text-amber-500" />
                          High Intent
                        </div>
                        <div className="text-[10px] text-muted-foreground">{lead.time}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                <Button variant="ghost" className="w-full border-2 border-dashed border-border/20 h-12 text-muted-foreground text-xs hover:border-border/50 hover:bg-muted/5">
                  <Plus className="h-3 w-3 mr-2" />
                  Add Lead
                </Button>
              </div>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

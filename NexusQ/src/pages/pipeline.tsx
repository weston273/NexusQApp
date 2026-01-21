import { 
  Plus, 
  MoreVertical, 
  Phone, 
  Mail, 
  MapPin,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const stages = [
  { 
    id: 'new', 
    title: 'New Leads', 
    leads: [
      { id: '1', name: 'Robert Fox', service: 'Plumbing Repair', value: '$250', time: '12m ago', priority: 'high' },
      { id: '2', name: 'Jane Cooper', service: 'Drain Cleaning', value: '$180', time: '45m ago', priority: 'medium' },
    ]
  },
  { 
    id: 'qualifying', 
    title: 'Qualifying', 
    leads: [
      { id: '3', name: 'Guy Hawkins', service: 'Water Heater', value: '$1,200', time: '2h ago', priority: 'high' },
    ]
  },
  { 
    id: 'quoted', 
    title: 'Quoted', 
    leads: [
      { id: '4', name: 'Eleanor Pena', service: 'Pipe Replacement', value: '$3,500', time: '5h ago', priority: 'medium' },
      { id: '5', name: 'Arlene McCoy', service: 'Fixture Install', value: '$450', time: '1d ago', priority: 'low' },
    ]
  },
  { 
    id: 'booked', 
    title: 'Booked', 
    leads: [
      { id: '6', name: 'Cody Fisher', service: 'Emergency Leak', value: '$600', time: '2h ago', priority: 'high' },
    ]
  },
];

export function Pipeline() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Revenue Pipeline</h1>
          <p className="text-muted-foreground mt-1">Track every dollar from intake to completion.</p>
        </div>
        <Button className="font-bold text-xs gap-2">
          <Plus className="h-4 w-4" /> New Manual Lead
        </Button>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-6">
        {stages.map((stage) => (
          <div key={stage.id} className="flex-shrink-0 w-80 space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight uppercase">{stage.title}</span>
                <Badge variant="secondary" className="text-[10px] h-5 rounded-full px-1.5">
                  {stage.leads.length}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              {stage.leads.map((lead) => (
                <Card key={lead.id} className="border bg-card/50 hover:border-primary/50 transition-colors cursor-pointer group shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="text-sm font-bold leading-none">{lead.name}</div>
                        <div className="text-xs text-muted-foreground font-medium">{lead.service}</div>
                      </div>
                      <div className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        lead.priority === 'high' ? "bg-status-error" : 
                        lead.priority === 'medium' ? "bg-status-warning" : "bg-status-info"
                      )} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-primary">{lead.value}</div>
                      <div className="flex -space-x-1.5">
                        <div className="h-6 w-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[8px] font-bold">
                          <Phone className="h-2.5 w-2.5" />
                        </div>
                        <div className="h-6 w-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[8px] font-bold">
                          <Mail className="h-2.5 w-2.5" />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/40">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {lead.time}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5" />
                        Dallas, TX
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              <Button variant="ghost" className="w-full border-2 border-dashed border-border/60 text-muted-foreground h-12 text-xs font-bold hover:bg-muted/50 hover:border-border transition-all">
                <Plus className="h-3 w-3 mr-2" /> Quick Add to Stage
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

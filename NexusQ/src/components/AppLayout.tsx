import React from 'react';
import { LayoutDashboard, Users, BarChart3, Settings, MessageSquare, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

const SidebarItem = ({ icon: Icon, label, active, onClick }: SidebarItemProps) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center w-full gap-3 px-4 py-2 text-sm font-medium transition-colors rounded-lg",
      active 
        ? "bg-primary text-primary-foreground" 
        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
    )}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('overview');

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside 
        className={cn(
          "flex flex-col border-r bg-card transition-all duration-300 ease-in-out",
          isSidebarOpen ? "w-64" : "w-0 lg:w-20 opacity-0 lg:opacity-100 overflow-hidden"
        )}
      >
        <div className="flex items-center h-16 px-6 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded bg-primary">
              <span className="text-lg font-bold text-primary-foreground">Q</span>
            </div>
            {isSidebarOpen && <span className="text-xl font-bold tracking-tight">NEXUS Q</span>}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <SidebarItem 
            icon={LayoutDashboard} 
            label={isSidebarOpen ? "Overview" : ""} 
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
          />
          <SidebarItem 
            icon={Users} 
            label={isSidebarOpen ? "Leads" : ""} 
            active={activeTab === 'leads'}
            onClick={() => setActiveTab('leads')}
          />
          <SidebarItem 
            icon={BarChart3} 
            label={isSidebarOpen ? "Analytics" : ""} 
            active={activeTab === 'analytics'}
            onClick={() => setActiveTab('analytics')}
          />
          <SidebarItem 
            icon={Settings} 
            label={isSidebarOpen ? "Settings" : ""} 
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
          />
        </nav>

        <div className="p-4 border-t shrink-0">
          <div className={cn(
            "flex items-center gap-3 p-2 rounded-lg bg-secondary/50",
            !isSidebarOpen && "justify-center"
          )}>
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold">
              JD
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold truncate">John Doe</span>
                <span className="text-xs text-muted-foreground truncate">Admin</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center justify-between h-16 px-6 border-b bg-card shrink-0">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:flex"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold capitalize">{activeTab}</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="hidden sm:flex">
              Demo Mode
            </Button>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto bg-secondary/20">
          {children}
        </main>
      </div>
    </div>
  );
};

import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BarChart3, 
  UserPlus, 
  Activity, 
  Settings,
  Menu,
  X,
  ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: BarChart3, label: 'Pipeline', path: '/pipeline' },
  { icon: UserPlus, label: 'Lead Intake', path: '/intake' },
  { icon: Activity, label: 'System Health', path: '/health' },
];

export function Sidebar() {
  const [isOpen, setIsOpen] = React.useState(true);

  return (
    <>
      {/* Mobile Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r bg-sidebar transition-transform duration-300 lg:static lg:translate-x-0",
          !isOpen && "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center border-b px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">NEXUS Q</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 p-4">
          <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
            Navigation
          </p>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="mt-auto border-t p-4">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70"
              )
            }
          >
            <Settings className="h-4 w-4" />
            Settings
          </NavLink>
          
          <div className="mt-4 flex items-center gap-3 px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
              OP
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold">Operator</span>
              <span className="text-[10px] text-muted-foreground">Nexus Q v1.0</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

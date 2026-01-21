import { Bell, Search, Activity, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b px-6 glass">
      {/* Left section */}
      <div className="flex items-center gap-4">
        <div>
          <h2 className="text-sm font-bold tracking-tight">
            Nexus Q Operations
          </h2>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="status-dot status-dot-success" />
            <span className="uppercase tracking-widest font-semibold">
              System Active
            </span>
          </div>
        </div>

        <Badge
          variant="outline"
          className="text-[9px] font-bold uppercase tracking-widest"
        >
          Live
        </Badge>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
        >
          <Search className="h-4 w-4" />
        </Button>

        {/* Activity */}
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
        >
          <Activity className="h-4 w-4" />
        </Button>

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-status-success animate-pulse" />
        </Button>

        {/* Divider */}
        <div className="h-6 w-px bg-border mx-1" />

        {/* Operator */}
        <button className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-muted transition">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
            OP
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className="text-xs font-semibold leading-none">
              Operator
            </span>
            <span className="text-[10px] text-muted-foreground">
              Admin Access
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </header>
  )
}

import { Bell, Search, Activity, ChevronDown, User, Settings, LogOut, Command } from 'lucide-react'
// import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
// import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'


export function Header({
  onToggleSidebar,
}: {
  onToggleSidebar: () => void
}) {
 
  return (
    <TooltipProvider>
     <header className="  sticky top-0 z-40 w-full glass h-16
        pl-14 md:px-6 px-4
        flex items-center justify-between
        transition-all duration-300
      ">
        {/* Left section: Sidebar Toggle & Status */}
      {/* <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        className="-ml-2 md:ml-0"
      >
        <Menu className="h-5 w-5" />
      </Button> */}
        <div className="flex items-center gap-2 md:gap-4 overflow-hidden flex-1 lg:flex-none">
          {/* <SidebarTrigger className="-ml-2 md:ml-0" /> */}
          <Separator orientation="vertical" className="h-4 hidden md:block" />
          
          <div className="flex flex-col justify-center overflow-hidden">
            <h2 className="text-sm font-bold tracking-tight truncate">
              Operations
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="status-dot status-dot-success shrink-0" />
              <span className="uppercase tracking-widest font-semibold truncate hidden xs:block">
                System Active
              </span>
            </div>
          </div>

          <Badge
            variant="outline"
            className="hidden sm:inline-flex text-[9px] font-bold uppercase tracking-widest h-5 px-1.5 bg-background/50 border-border/50 shrink-0"
          >
            Live
          </Badge>
        </div>

        {/* Center section: Search (Desktop only) */}
        <div className="hidden lg:flex items-center max-w-sm xl:max-w-md w-full mx-8">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search systems..."
              className="pl-9 bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-primary h-9 transition-all"
            />
            <kbd className="absolute right-2.5 top-2.5 h-4 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground flex">
              <Command className="h-2 w-2" /> K
            </kbd>
          </div>
        </div>

        {/* Right section: Actions & User */}
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          {/* Action Buttons (Responsive) */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/50 lg:hidden"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Search</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/50 hidden md:flex"
                >
                  <Activity className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>System Activity</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute top-2.5 right-2.5 h-1.5 w-1.5 rounded-full bg-status-success animate-pulse" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Notifications</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-border/50 mx-1 hidden sm:block" />

          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full md:rounded-lg p-1 md:pr-2 md:pl-1.5 hover:bg-muted/50 transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary group">
                <Avatar className="h-8 w-8 border border-border/50 ring-offset-background group-hover:ring-2 group-hover:ring-primary/20 transition-all">
                  <AvatarImage src="" />
                  <AvatarFallback className="text-[10px] font-bold bg-primary text-primary-foreground">
                    OP
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col text-left overflow-hidden">
                  <span className="text-xs font-semibold leading-none truncate max-w-[80px]">
                    Operator
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                    Admin
                  </span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors hidden md:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">Operator Alpha</span>
                  <span className="text-[10px] text-muted-foreground">operator@system.io</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 cursor-pointer">
                <User className="h-4 w-4" />
                <span>Profile Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer">
                <Settings className="h-4 w-4" />
                <span>System Config</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </TooltipProvider>
  )
}

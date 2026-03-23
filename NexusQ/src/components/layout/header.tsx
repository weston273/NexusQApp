import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  Activity,
  ChevronDown,
  Check,
  User,
  Settings,
  LogOut,
  Command,
  Menu,
  UserPlus,
  LayoutDashboard,
  BarChart3,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLeads } from "@/hooks/useLeads";
import { loadAppSettings, SETTINGS_CHANGED_EVENT } from "@/lib/userSettings";
import { useAuth } from "@/context/AuthProvider";
import { getUserDisplayName } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";
import { getAccessRoleLabel } from "@/lib/permissions";
import { NotificationCenterPanel } from "@/features/notifications/components/NotificationCenterPanel";
import { useNotificationCenterContext } from "@/features/notifications/NotificationCenterProvider";

function isTypingTarget(target: EventTarget | null) {
  const node = target as HTMLElement | null;
  if (!node) return false;
  if (node.isContentEditable) return true;
  const tag = typeof node.tagName === "string" ? node.tagName.toLowerCase() : "";
  return tag === "input" || tag === "textarea" || tag === "select";
}

export function Header({
  onToggleSidebar,
}: {
  onToggleSidebar: () => void;
}) {
  const navigate = useNavigate();
  const { user, profile, role, clientId, accessRows, setActiveClientId, signOut } = useAuth();
  const { leads, loading, error, lastLoadedAt } = useLeads();
  const { notificationsEnabled, unreadCount } = useNotificationCenterContext();
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [clockTick, setClockTick] = React.useState(() => Date.now());
  const [settingsState, setSettingsState] = React.useState(() => loadAppSettings());
  const goKeyAtRef = React.useRef<number>(0);

  const displayName = profile?.full_name || settingsState.operatorName || getUserDisplayName(user);
  const displayEmail = profile?.email || user?.email || settingsState.operatorEmail || "";
  const displayRole = getAccessRoleLabel(role);
  const initials = (displayName || "OP")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
    .join("");

  React.useEffect(() => {
    const navShortcuts: Record<string, string> = {
      d: "/",
      p: "/pipeline",
      i: "/intake",
      h: "/health",
      n: "/notifications",
      s: "/settings",
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
      if (!key) return;
      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
        return;
      }

      if (isTypingTarget(event.target)) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const now = Date.now();
      if (key === "g") {
        goKeyAtRef.current = now;
        return;
      }

      if (now - goKeyAtRef.current > 1000) return;
      const path = navShortcuts[key];
      if (!path) return;
      event.preventDefault();
      navigate(path);
      setCommandOpen(false);
      goKeyAtRef.current = 0;
    };

    const onSettingsChanged = () => setSettingsState(loadAppSettings());
    const tickId = window.setInterval(() => setClockTick(Date.now()), 15000);

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged as EventListener);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged as EventListener);
      window.clearInterval(tickId);
    };
  }, [navigate]);

  const trustMeta = React.useMemo(() => {
    const source = "Supabase Realtime";
    if (!lastLoadedAt) {
      return {
        source,
        stateLabel: loading ? "Syncing" : "Awaiting Sync",
        stateTone: loading ? "info" : "warning",
        lastSyncLabel: "No successful sync yet",
      };
    }

    const ageMs = Math.max(0, clockTick - lastLoadedAt.getTime());
    const ageSec = Math.floor(ageMs / 1000);
    const stale = ageSec >= 90;
    const ageLabel =
      ageSec < 60
        ? `${ageSec}s ago`
        : ageSec < 3600
        ? `${Math.floor(ageSec / 60)}m ago`
        : `${Math.floor(ageSec / 3600)}h ago`;

    if (error) {
      return {
        source,
        stateLabel: "Degraded",
        stateTone: "error",
        lastSyncLabel: `Last sync ${ageLabel}`,
      };
    }
    if (loading) {
      return {
        source,
        stateLabel: "Syncing",
        stateTone: "info",
        lastSyncLabel: `Last sync ${ageLabel}`,
      };
    }
    return {
      source,
      stateLabel: stale ? "Stale" : "Healthy",
      stateTone: stale ? "warning" : "success",
      lastSyncLabel: `Last sync ${ageLabel}`,
    };
  }, [clockTick, error, lastLoadedAt, loading]);

  const trustDotClass =
    trustMeta.stateTone === "success"
      ? "bg-status-success"
      : trustMeta.stateTone === "warning"
      ? "bg-status-warning"
      : trustMeta.stateTone === "error"
      ? "bg-status-error"
      : "bg-status-info";

  const topLeads = React.useMemo(() => leads.slice(0, 8), [leads]);

  const navigateAndClose = (path: string) => {
    navigate(path);
    setCommandOpen(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/login", { replace: true });
      toast.success("Signed out.");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Sign-out failed. Please try again."));
    }
  };

  return (
    <TooltipProvider>
      <header className="sticky top-0 z-40 w-full glass h-16 pl-14 md:px-6 px-4 flex items-center justify-between transition-all duration-300">
        <div className="flex items-center gap-2 md:gap-4 overflow-hidden flex-1 lg:flex-none">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="hidden lg:inline-flex h-10 w-10"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-4 hidden md:block" />

          <div className="flex flex-col justify-center overflow-hidden">
            <h2 className="text-sm font-bold tracking-tight truncate">Operations</h2>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground" aria-live="polite">
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${trustDotClass}`} />
              <span className="uppercase tracking-widest font-semibold truncate hidden xs:block">{trustMeta.stateLabel}</span>
              <span className="hidden md:inline truncate">{trustMeta.source}</span>
              <span className="hidden lg:inline truncate">{trustMeta.lastSyncLabel}</span>
            </div>
          </div>

          <Badge
            variant="outline"
            className="hidden sm:inline-flex text-[9px] font-bold uppercase tracking-widest h-5 px-1.5 bg-background/50 border-border/50 shrink-0"
          >
            Live
          </Badge>
        </div>

        <div className="hidden lg:flex items-center max-w-sm xl:max-w-md w-full mx-8">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              readOnly
              onFocus={() => setCommandOpen(true)}
              onClick={() => setCommandOpen(true)}
              placeholder="Search leads, pages, activity..."
              className="pl-9 bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-primary h-10 transition-all cursor-pointer"
              aria-label="Open global search"
            />
            <kbd className="absolute right-2.5 top-2.5 h-4 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground flex">
              <Command className="h-2 w-2" /> K
            </kbd>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          <div className="hidden xl:flex items-center gap-1">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-10" onClick={() => navigate("/intake")}>
              <UserPlus className="h-3.5 w-3.5" />
              Add Lead
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-10" onClick={() => navigate("/pipeline")}>
              <BarChart3 className="h-3.5 w-3.5" />
              Pipeline
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-10" onClick={() => navigate("/health")}>
              <Activity className="h-3.5 w-3.5" />
              Health
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-muted/50 lg:hidden"
                  onClick={() => setCommandOpen(true)}
                  aria-label="Search"
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
                  className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-muted/50 hidden md:flex"
                  onClick={() => navigate("/health")}
                  aria-label="System activity"
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
                  className="relative h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  onClick={() => setNotificationsOpen(true)}
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {notificationsEnabled && unreadCount > 0 ? (
                    <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-status-success animate-pulse" />
                  ) : null}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Notifications</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  onClick={() => navigate("/settings")}
                  aria-label="Settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Settings</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="h-6 w-px bg-border/50 mx-1 hidden sm:block" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 rounded-full md:rounded-lg p-1 md:pr-2 md:pl-1.5 hover:bg-muted/50 transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary group"
                aria-label="User menu"
              >
                <Avatar className="h-8 w-8 border border-border/50 ring-offset-background group-hover:ring-2 group-hover:ring-primary/20 transition-all">
                  <AvatarImage src={profile?.avatar_url ?? ""} />
                  <AvatarFallback className="text-[10px] font-bold bg-primary text-primary-foreground">
                    {initials || "OP"}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col text-left overflow-hidden">
                  <span className="text-xs font-semibold leading-none truncate max-w-[80px]">{displayName || "Operator"}</span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{displayRole}</span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors hidden md:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{displayName || "Operator"}</span>
                  <span className="text-[10px] text-muted-foreground">{displayEmail || "No email"}</span>
                </div>
              </DropdownMenuLabel>
              {accessRows.length > 1 ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Workspace
                  </DropdownMenuLabel>
                  {accessRows.map((access) => (
                    <DropdownMenuItem
                      key={access.id}
                      className="gap-2 cursor-pointer"
                      onClick={() => setActiveClientId(access.client_id)}
                    >
                      {clientId === access.client_id ? <Check className="h-4 w-4" /> : <span className="h-4 w-4" />}
                      <span className="truncate text-xs">{access.client_id.slice(0, 8)}</span>
                      <span className="ml-auto text-[10px] uppercase text-muted-foreground">{getAccessRoleLabel(access.role)}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => navigate("/link-workspace?mode=join")}>
                <UserPlus className="h-4 w-4" />
                <span>Join Workspace</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => navigate("/settings")}>
                <User className="h-4 w-4" />
                <span>Profile Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => navigate("/settings")}>
                <Settings className="h-4 w-4" />
                <span>System Config</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                onClick={() => {
                  void handleSignOut();
                }}
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Search pages, leads, and activity..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => navigateAndClose("/")}>
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
              <CommandShortcut>G D</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => navigateAndClose("/pipeline")}>
              <BarChart3 className="h-4 w-4" />
              Pipeline
              <CommandShortcut>G P</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => navigateAndClose("/intake")}>
              <UserPlus className="h-4 w-4" />
              Lead Intake
              <CommandShortcut>G I</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => navigateAndClose("/health")}>
              <Activity className="h-4 w-4" />
              System Health
              <CommandShortcut>G H</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => navigateAndClose("/notifications")}>
              <Inbox className="h-4 w-4" />
              Notifications
              <CommandShortcut>G N</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => navigateAndClose("/settings")}>
              <Settings className="h-4 w-4" />
              Settings
              <CommandShortcut>G S</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Recent Leads">
            {topLeads.length ? (
              topLeads.map((lead) => (
                <CommandItem key={lead.id} onSelect={() => navigateAndClose(`/pipeline?lead=${encodeURIComponent(lead.id)}`)}>
                  <User className="h-4 w-4" />
                  <span>{lead.name || lead.phone || "Unknown Lead"}</span>
                  <CommandShortcut>{(lead.status || "new").toUpperCase()}</CommandShortcut>
                </CommandItem>
              ))
            ) : (
              <CommandItem disabled>No leads available.</CommandItem>
            )}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <DialogContent className="!left-auto !right-0 !top-0 !translate-x-0 !translate-y-0 h-screen w-[92vw] max-w-md rounded-none border-l p-0">
          <DialogHeader className="p-4 pb-3 border-b">
            <DialogTitle className="text-base flex items-center justify-between">
              Notifications
              <Badge variant="outline" className="text-[10px]">
                {unreadCount} unread
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[calc(100vh-84px)] overflow-y-auto p-4">
            <NotificationCenterPanel compact showViewAll onAfterNavigate={() => setNotificationsOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

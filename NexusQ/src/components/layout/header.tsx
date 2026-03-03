import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  Activity,
  ChevronDown,
  User,
  Settings,
  LogOut,
  Command,
  Menu,
  UserPlus,
  LayoutDashboard,
  BarChart3,
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLeads } from "@/hooks/useLeads";
import { loadAppSettings, SETTINGS_CHANGED_EVENT } from "@/lib/userSettings";

const LAST_NOTIFICATION_READ_KEY = "nexusq.notifications.lastReadAt";

function eventSeverity(eventType: string): "high" | "medium" | "low" {
  const t = (eventType || "").toLowerCase();
  if (t.includes("failed") || t.includes("error")) return "high";
  if (t.includes("status") || t.includes("quoted") || t.includes("booked")) return "medium";
  return "low";
}

function eventLabel(eventType: string) {
  return (eventType || "unknown").replace(/_/g, " ");
}

function isTypingTarget(target: EventTarget | null) {
  const node = target as HTMLElement | null;
  if (!node) return false;
  if (node.isContentEditable) return true;
  const tag = node.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

export function Header({
  onToggleSidebar,
}: {
  onToggleSidebar: () => void;
}) {
  const navigate = useNavigate();
  const { leads, events, loading, error, lastLoadedAt } = useLeads();
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [clockTick, setClockTick] = React.useState(Date.now());
  const [lastReadAt, setLastReadAt] = React.useState<number>(() => {
    const raw = localStorage.getItem(LAST_NOTIFICATION_READ_KEY);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  });
  const [settingsState, setSettingsState] = React.useState(() => loadAppSettings());
  const goKeyAtRef = React.useRef<number>(0);

  React.useEffect(() => {
    const navShortcuts: Record<string, string> = {
      d: "/",
      p: "/pipeline",
      i: "/intake",
      h: "/health",
      s: "/settings",
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
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

  React.useEffect(() => {
    if (!notificationsOpen) return;
    const now = Date.now();
    setLastReadAt(now);
    localStorage.setItem(LAST_NOTIFICATION_READ_KEY, String(now));
  }, [notificationsOpen]);

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

  const unreadCount = React.useMemo(() => {
    if (!settingsState.pushNotifications) return 0;
    return events.filter((event) => {
      const ts = new Date(event.created_at).getTime();
      return Number.isFinite(ts) && ts > lastReadAt;
    }).length;
  }, [events, lastReadAt, settingsState.pushNotifications]);

  const topLeads = React.useMemo(() => leads.slice(0, 8), [leads]);
  const recentEvents = React.useMemo(() => {
    const seen = new Set<string>();
    const out: typeof events = [];
    for (const event of events) {
      const key = `${event.event_type}|${event.lead_id ?? "na"}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(event);
      if (out.length >= 12) break;
    }
    return out;
  }, [events]);

  const navigateAndClose = (path: string) => {
    navigate(path);
    setCommandOpen(false);
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
                  {settingsState.pushNotifications && unreadCount > 0 ? (
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
                  <AvatarImage src="" />
                  <AvatarFallback className="text-[10px] font-bold bg-primary text-primary-foreground">OP</AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col text-left overflow-hidden">
                  <span className="text-xs font-semibold leading-none truncate max-w-[80px]">{settingsState.operatorName || "Operator"}</span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">Admin</span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors hidden md:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{settingsState.operatorName || "Operator Alpha"}</span>
                  <span className="text-[10px] text-muted-foreground">{settingsState.operatorEmail || "operator@system.io"}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
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
                onClick={() => toast.info("Sign out is not configured yet.")}
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
                <CommandItem key={lead.id} onSelect={() => navigateAndClose("/pipeline")}>
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
          <DialogHeader className="p-4 pb-2 border-b">
            <DialogTitle className="text-base flex items-center justify-between">
              Notifications
              <Badge variant="outline" className="text-[10px]">
                {unreadCount} unread
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs">Live activity updates from lead events and workflows.</DialogDescription>
          </DialogHeader>

          {!settingsState.pushNotifications ? (
            <div className="m-4 rounded-md border p-3 text-xs text-muted-foreground">Push notifications are disabled in settings.</div>
          ) : null}

          <div className="max-h-[calc(100vh-96px)] overflow-y-auto p-3 space-y-2">
            {recentEvents.length ? (
              recentEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => {
                    navigate("/pipeline");
                    setNotificationsOpen(false);
                  }}
                  className="w-full rounded-lg border bg-card p-3 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-semibold capitalize">{eventLabel(event.event_type)}</div>
                      <Badge
                        variant="outline"
                        className={
                          eventSeverity(event.event_type) === "high"
                            ? "text-[9px] border-status-error/40 text-status-error"
                            : eventSeverity(event.event_type) === "medium"
                            ? "text-[9px] border-status-warning/40 text-status-warning"
                            : "text-[9px] border-status-info/40 text-status-info"
                        }
                      >
                        {eventSeverity(event.event_type)}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{new Date(event.created_at).toLocaleTimeString()}</div>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                    {event.lead_id ? `Lead #${event.lead_id.slice(0, 8)}` : "System event"}
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No notifications yet.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}


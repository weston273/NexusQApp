import { Activity, ArrowRight, Bell, BarChart3, HeartPulse, Inbox, ShieldCheck, UserPlus, Workflow } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/context/AuthProvider";
import { normalizeWorkflowName } from "@/features/health/utils";
import { getAccessRoleLabel } from "@/lib/permissions";

const principleCards = [
  {
    title: "What a lead means here",
    description:
      "A lead is one customer request or opportunity. It carries contact information, service intent, urgency, message history, workflow signals, and pipeline status for one workspace.",
  },
  {
    title: "What NexusQ is for",
    description:
      "NexusQ is an operations layer for service businesses. It helps teams capture requests, respond faster, track pipeline movement, and keep automation visible instead of hidden behind disconnected tools.",
  },
  {
    title: "What it improves",
    description:
      "The app reduces manual follow-up gaps, keeps operators focused on the next action, and gives each workspace its own protected operational lane so teams can scale without cross-client spillover.",
  },
];

const processSteps = [
  {
    title: "1. Intake captures the request",
    detail: "A new request enters through the intake flow and is attached to the active workspace so tenant context is set from the start.",
    icon: UserPlus,
  },
  {
    title: "2. Automations react quickly",
    detail: "Workflows handle first response, follow-up, message processing, and health signals so operators do not lose momentum on early-stage leads.",
    icon: Workflow,
  },
  {
    title: "3. Pipeline turns intent into revenue",
    detail: "Operators qualify, quote, and book leads while tracking stage movement and value in USD so the board reflects real opportunity.",
    icon: BarChart3,
  },
  {
    title: "4. Health keeps the system trustworthy",
    detail: "Health monitoring surfaces workflow freshness, degraded states, and browser-side trust signals so issues are visible before they become operational blind spots.",
    icon: HeartPulse,
  },
  {
    title: "5. Notifications close the loop",
    detail: "Messages, events, and attention items help teams act on the right lead at the right time instead of checking every surface manually.",
    icon: Bell,
  },
];

const workflowCards = [
  {
    key: "A",
    title: normalizeWorkflowName("A"),
    summary: "Captures and normalizes incoming lead requests into the right workspace.",
    icon: ShieldCheck,
  },
  {
    key: "B",
    title: normalizeWorkflowName("B"),
    summary: "Handles fast first-response behavior so new leads hear back quickly.",
    icon: Inbox,
  },
  {
    key: "C",
    title: normalizeWorkflowName("C"),
    summary: "Processes ongoing customer messaging and follow-up activity.",
    icon: Workflow,
  },
  {
    key: "D",
    title: normalizeWorkflowName("D"),
    summary: "Moves leads through qualifying, quoted, and booked stages while preserving revenue value.",
    icon: BarChart3,
  },
  {
    key: "E",
    title: normalizeWorkflowName("E"),
    summary: "Aggregates workflow health signals so operators can trust what the app is showing.",
    icon: Activity,
  },
  {
    key: "F",
    title: normalizeWorkflowName("F"),
    summary: "Runs the AI SMS agent, uses client pricing and conversation memory, and advances pipeline stages when intent is clear.",
    icon: Workflow,
  },
];

const outcomePoints = [
  "Faster first responses and less manual lead chasing.",
  "A clearer board for quotes, booked work, and missing value gaps.",
  "Health visibility when automation starts drifting or going stale.",
  "Tenant-safe workspace switching so one client’s operations stay separate from another’s.",
];

export function AboutPage() {
  const navigate = useNavigate();
  const { accessRows, clientId, role } = useAuth();
  const activeWorkspace = accessRows.find((row) => row.client_id === clientId) ?? null;
  const workspaceLabel = activeWorkspace?.client_name?.trim() || (clientId ? `Workspace ${clientId.slice(0, 8)}` : "No workspace linked");

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="About NexusQ"
        description="How the app works, what a lead represents, and how the workspace is designed to improve day-to-day operations."
        actions={
          <>
            <Button variant="outline" size="sm" className="h-10 gap-2" onClick={() => navigate("/pipeline")}>
              Open Pipeline
            </Button>
            <Button size="sm" className="h-10 gap-2" onClick={() => navigate("/intake")}>
              Create Lead
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </>
        }
      />

      <Card className="border-none bg-muted/20">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Operator Guide</div>
            <div className="text-3xl font-bold tracking-tight">One place to capture leads, run follow-up, and move revenue forward.</div>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
              NexusQ is designed for service operations where speed, visibility, and tenant separation matter. It turns new
              requests into trackable pipeline work, keeps automation observable, and helps operators focus on what needs attention next.
            </p>
          </div>

          <div className="rounded-2xl border bg-background p-5 space-y-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Active Workspace</div>
              <div className="mt-1 text-lg font-semibold">{workspaceLabel}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Your Access</div>
              <div className="mt-1 text-sm font-semibold">{getAccessRoleLabel(role)}</div>
            </div>
            <p className="text-xs leading-6 text-muted-foreground">
              Every workspace keeps its own leads, pipeline activity, notifications, and health signals. Switching workspaces changes the tenant context, not just the screen you are looking at.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {principleCards.map((card) => (
          <Card key={card.title} className="border-none bg-muted/20">
            <CardHeader>
              <CardTitle className="text-base">{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-7 text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none bg-muted/20">
        <CardHeader>
          <CardTitle className="text-base">How The App Works</CardTitle>
          <CardDescription>The core operating loop from intake to closed work.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-5">
          {processSteps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="rounded-2xl border bg-background p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="mt-4 text-sm font-semibold">{step.title}</div>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">{step.detail}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-none bg-muted/20">
        <CardHeader>
          <CardTitle className="text-base">Workflow Map</CardTitle>
          <CardDescription>What each workflow contributes in business terms.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {workflowCards.map((workflow) => {
            const Icon = workflow.icon;

            return (
              <div key={workflow.key} className="rounded-2xl border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{workflow.key}</span>
                </div>
                <div className="mt-4 text-sm font-semibold">{workflow.title}</div>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">{workflow.summary}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-none bg-muted/20">
        <CardHeader>
          <CardTitle className="text-base">What Good Use Looks Like</CardTitle>
          <CardDescription>Signals that the workspace is getting value from NexusQ.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {outcomePoints.map((point) => (
            <div key={point} className="rounded-xl border bg-background p-4 text-sm leading-7 text-muted-foreground">
              {point}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

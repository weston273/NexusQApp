import * as React from "react";
import { AlertTriangle, ArrowRight, RefreshCcw, Send, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AttentionItem, DashboardAiBriefing, DashboardAiThreadItem } from "@/features/dashboard/types";

type DashboardAiAnalystPanelProps = {
  attentionItems: AttentionItem[];
  briefing: DashboardAiBriefing | null;
  thread: DashboardAiThreadItem[];
  loading: boolean;
  asking: boolean;
  paused: boolean;
  error: string | null;
  lastLoadedAt: Date | null;
  onRefresh: () => void;
  onAskQuestion: (question: string) => Promise<unknown>;
};

function priorityClasses(priority: "high" | "medium" | "low") {
  if (priority === "high") return "bg-status-error/15 text-status-error border-status-error/30";
  if (priority === "medium") return "bg-status-warning/15 text-status-warning border-status-warning/30";
  return "bg-status-success/15 text-status-success border-status-success/30";
}

function toneClasses(tone: AttentionItem["tone"]) {
  if (tone === "high") return "border-status-error/25 bg-status-error/5";
  if (tone === "medium") return "border-status-warning/30 bg-status-warning/10";
  return "border-border/60 bg-muted/20";
}

function badgeClasses(tone: AttentionItem["tone"]) {
  if (tone === "high") return "text-status-error bg-status-error/10";
  if (tone === "medium") return "text-status-warning bg-status-warning/15";
  return "text-muted-foreground bg-background";
}

export function DashboardAiAnalystPanel({
  attentionItems,
  briefing,
  thread,
  loading,
  asking,
  paused,
  error,
  lastLoadedAt,
  onRefresh,
  onAskQuestion,
}: DashboardAiAnalystPanelProps) {
  const navigate = useNavigate();
  const [question, setQuestion] = React.useState("");
  const visibleThread = React.useMemo(() => thread.slice(-2), [thread]);

  const submitQuestion = React.useCallback(async () => {
    const trimmed = question.trim();
    if (!trimmed || asking) return;
    const result = await onAskQuestion(trimmed);
    if (result) {
      setQuestion("");
    }
  }, [asking, onAskQuestion, question]);

  return (
    <Card className="border-none bg-gradient-to-br from-muted/20 via-background to-muted/10">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Needs Attention Now</CardTitle>
            <Badge variant="outline" className="text-[10px] uppercase tracking-[0.22em]">
              NexusQ
            </Badge>
          </div>
          <CardDescription>
            Priority actions, grounded answers, and next steps surfaced from live lead, response, revenue, conversation, and system signals across this workspace.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[10px] uppercase tracking-[0.22em]">
            {lastLoadedAt ? `Updated ${lastLoadedAt.toLocaleTimeString()}` : "Awaiting analysis"}
          </Badge>
          <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => navigate("/pipeline")}>
            Review Pipeline
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-2" onClick={onRefresh} disabled={loading || asking}>
            <RefreshCcw className={cn("h-3.5 w-3.5", loading ? "animate-spin" : "")} />
            {paused ? "Retry Analysis" : "Refresh Analysis"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {error ? (
          <div className="rounded-2xl border border-status-error/25 bg-status-error/5 p-4 text-sm text-status-error">
            {error}
          </div>
        ) : null}

        {attentionItems.length ? (
          <div className="grid gap-3 xl:grid-cols-3">
            {attentionItems.map((item) => {
              const Icon = item.icon;

              return (
                <div key={`${item.title}-${item.actionPath}`} className={cn("rounded-2xl border p-4", toneClasses(item.tone))}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="rounded-xl bg-background/80 p-2">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]",
                        badgeClasses(item.tone)
                      )}
                    >
                      {item.countLabel}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="text-sm font-semibold">{item.title}</div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                  </div>

                  <Button
                    variant="ghost"
                    className="mt-4 h-9 px-0 text-xs font-semibold"
                    onClick={() => navigate(item.actionPath)}
                  >
                    {item.actionLabel}
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed bg-muted/10 p-4 text-sm text-muted-foreground">
            No urgent operational items are surfaced right now. NexusQ will keep updating this section as the workspace changes.
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    {briefing?.headline ?? (loading ? "Analyzing workspace operations..." : "No analysis available yet")}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {briefing?.summary ??
                      "The analyst will summarize what matters operationally once the workspace analysis is ready."}
                  </p>
                </div>
              </div>
              {briefing?.situation ? (
                <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm leading-relaxed">
                  {briefing.situation}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border bg-card p-5">
                <div className="text-sm font-semibold">Opportunities</div>
                <div className="mt-3 space-y-2">
                  {(briefing?.opportunities.length ? briefing.opportunities : ["No major opportunities surfaced yet."]).map((item) => (
                    <div key={item} className="rounded-xl border border-status-success/20 bg-status-success/5 p-3 text-sm">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border bg-card p-5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  Risks
                </div>
                <div className="mt-3 space-y-2">
                  {(briefing?.risks.length ? briefing.risks : ["No major risks surfaced yet."]).map((item) => (
                    <div key={item} className="rounded-xl border border-status-warning/25 bg-status-warning/10 p-3 text-sm">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5">
              <div className="text-sm font-semibold">Recommended Actions</div>
              <div className="mt-3 grid gap-3">
                {(briefing?.recommendedActions.length ? briefing.recommendedActions : []).map((action) => (
                  <div key={`${action.title}-${action.actionPath}`} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{action.title}</div>
                        <p className="mt-1 text-sm text-muted-foreground">{action.detail}</p>
                      </div>
                      <Badge variant="outline" className={priorityClasses(action.priority)}>
                        {action.priority}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3 h-8 px-0 text-xs font-semibold"
                      onClick={() => navigate(action.actionPath)}
                    >
                      Open {action.actionPath === "/" ? "dashboard" : action.actionPath.replace("/", "")}
                    </Button>
                  </div>
                ))}
                {!briefing?.recommendedActions.length ? (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    Action suggestions will appear here after the first analysis run.
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-5">
              <div className="text-sm font-semibold">Ask NexusQ About This Workspace</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Example questions: what deals were booked, which conversations stalled, what changed today, or which leads need follow-up.
              </p>

              <div className="mt-4 space-y-3">
                <Textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  disabled={paused || loading}
                  placeholder="Ask about a lead, a deal, a conversation, or what changed in the system..."
                  className="min-h-[120px] resize-y"
                />
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {(briefing?.suggestedQuestions ?? []).slice(0, 3).map((item) => (
                      <Button
                        key={item}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={paused || loading}
                        onClick={() => setQuestion(item)}
                      >
                        {item}
                      </Button>
                    ))}
                  </div>
                  <Button className="gap-2" onClick={submitQuestion} disabled={paused || loading || asking || !question.trim()}>
                    <Send className="h-3.5 w-3.5" />
                    {asking ? "Thinking..." : paused ? "Refresh To Resume" : "Ask"}
                  </Button>
                </div>
                {paused ? (
                  <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-3 text-xs text-muted-foreground">
                    The analyst is paused after a failed AI request. The rest of the dashboard stays live while you retry from this panel.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">Latest NexusQ Exchange</div>
                <div className="text-[11px] text-muted-foreground">Showing latest exchange only</div>
              </div>
              <div className="mt-4 space-y-3">
                {!thread.length ? (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    Ask a workspace question to start a grounded NexusQ analysis thread.
                  </div>
                ) : null}

                {visibleThread.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "rounded-2xl border p-4",
                      item.role === "assistant" ? "bg-primary/5 border-primary/20" : "bg-muted/20"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
                        {item.role === "assistant" ? "NexusQ Analyst" : "You"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(item.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="mt-2 text-sm leading-relaxed">{item.content}</div>
                    {item.answer ? (
                      <div className="mt-3 space-y-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">Confidence {item.answer.confidence}%</Badge>
                          {item.answer.referencedLeads.slice(0, 2).map((lead) => (
                            <Badge key={lead} variant="outline">
                              {lead}
                            </Badge>
                          ))}
                        </div>
                        {item.answer.evidence.length ? (
                          <div className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Evidence</div>
                            {item.answer.evidence.map((evidence) => (
                              <div key={evidence} className="rounded-xl border bg-background/70 p-3 text-xs text-muted-foreground">
                                {evidence}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {item.answer.followUps.length ? (
                          <div className="flex flex-wrap gap-2">
                            {item.answer.followUps.slice(0, 3).map((followUp) => (
                              <Button
                                key={followUp}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => setQuestion(followUp)}
                              >
                                {followUp}
                              </Button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

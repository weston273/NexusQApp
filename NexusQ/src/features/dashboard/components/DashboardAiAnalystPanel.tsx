import * as React from "react";
import { AlertTriangle, Brain, RefreshCcw, Send, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { DashboardAiBriefing, DashboardAiThreadItem } from "@/features/dashboard/types";

type DashboardAiAnalystPanelProps = {
  briefing: DashboardAiBriefing | null;
  thread: DashboardAiThreadItem[];
  loading: boolean;
  asking: boolean;
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

export function DashboardAiAnalystPanel({
  briefing,
  thread,
  loading,
  asking,
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
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
            <Brain className="h-3.5 w-3.5" />
            AI Operations Analyst
          </div>
          <CardTitle className="text-xl">OpenRouter-enhanced workspace analysis</CardTitle>
          <CardDescription>
            Ask about lead flow, conversations, follow-up activity, quotes, booked deals, and system behavior across this workspace.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] uppercase tracking-[0.22em]">
            {lastLoadedAt ? `Updated ${lastLoadedAt.toLocaleTimeString()}` : "Awaiting analysis"}
          </Badge>
          <Button variant="outline" size="sm" className="h-9 gap-2" onClick={onRefresh} disabled={loading || asking}>
            <RefreshCcw className={cn("h-3.5 w-3.5", loading ? "animate-spin" : "")} />
            Refresh Analysis
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {error ? (
          <div className="rounded-2xl border border-status-error/25 bg-status-error/5 p-4 text-sm text-status-error">
            {error}
          </div>
        ) : null}

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
              <div className="text-sm font-semibold">Ask About This Workspace</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Example questions: what deals were booked, which conversations stalled, what changed today, or which leads need follow-up.
              </p>

              <div className="mt-4 space-y-3">
                <Textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
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
                        onClick={() => setQuestion(item)}
                      >
                        {item}
                      </Button>
                    ))}
                  </div>
                  <Button className="gap-2" onClick={submitQuestion} disabled={asking || !question.trim()}>
                    <Send className="h-3.5 w-3.5" />
                    {asking ? "Thinking..." : "Ask"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">Conversation Thread</div>
                <div className="text-[11px] text-muted-foreground">Showing latest exchange only</div>
              </div>
              <div className="mt-4 space-y-3">
                {!thread.length ? (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    Ask a workspace question to start a grounded analysis thread.
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
                        {item.role === "assistant" ? "AI Analyst" : "You"}
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

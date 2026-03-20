import { ArrowDownLeft, ArrowUpRight, Bot, Mail, MessageSquareText, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLeadMessages } from "@/hooks/useLeadMessages";
import type { MessageRecord } from "@/lib/types/domain";

function getDirectionLabel(direction: MessageRecord["direction"]) {
  if (direction === "inbound") return "Inbound";
  if (direction === "outbound") return "Outbound";
  if (direction === "system") return "System";
  return "Unknown";
}

function getDirectionIcon(direction: MessageRecord["direction"]) {
  if (direction === "inbound") return ArrowDownLeft;
  if (direction === "outbound") return ArrowUpRight;
  return Bot;
}

function getChannelIcon(channel: string | null) {
  if (channel === "email") return Mail;
  return MessageSquareText;
}

type PipelineMessageTimelineProps = {
  leadId: string | null;
  open: boolean;
};

export function PipelineMessageTimeline({ leadId, open }: PipelineMessageTimelineProps) {
  const { messages, loading, error, refresh, lastLoadedAt } = useLeadMessages(leadId, {
    enabled: open && Boolean(leadId),
    limit: 6,
  });

  const latestMessage = messages[0] ?? null;

  return (
    <div className="border-t pt-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recent Messages</div>
          <div className="text-[11px] text-muted-foreground">
            {latestMessage
              ? `Latest touchpoint ${new Date(latestMessage.createdAt).toLocaleString()}`
              : "No stored communication history for this lead yet."}
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-[10px]" onClick={refresh} disabled={loading || !leadId}>
          <RefreshCcw className="h-3 w-3" />
          Refresh
        </Button>
      </div>

      {loading ? <div className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">Loading recent messages...</div> : null}
      {error ? <div className="rounded-md border border-status-warning/30 bg-status-warning/5 px-3 py-2 text-xs text-status-warning">{error}</div> : null}

      {messages.length ? (
        <div className="space-y-2">
          {messages.map((message) => {
            const DirectionIcon = getDirectionIcon(message.direction);
            const ChannelIcon = getChannelIcon(message.channel);

            return (
              <div key={message.id} className="rounded-lg border bg-background p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">
                      <DirectionIcon className="mr-1 h-3 w-3" />
                      {getDirectionLabel(message.direction)}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      <ChannelIcon className="mr-1 h-3 w-3" />
                      {message.channel ?? "message"}
                    </Badge>
                    {message.status ? (
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {message.status}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {new Date(message.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="text-xs leading-relaxed text-foreground/90">
                  {message.body || "No preview text stored for this message."}
                </div>

                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{message.provider ?? "Unknown provider"}</span>
                  {message.providerMessageId ? <span className="font-mono">ID {message.providerMessageId}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {!loading && !error && !messages.length ? (
        <div className="rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground">
          Stored SMS, email, and provider message history will appear here when available.
        </div>
      ) : null}

      {lastLoadedAt ? <div className="text-[10px] text-muted-foreground">Last synced {lastLoadedAt.toLocaleTimeString()}</div> : null}
    </div>
  );
}

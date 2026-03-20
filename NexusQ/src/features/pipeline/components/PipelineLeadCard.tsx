import { useDraggable } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, GripVertical, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { UiLead } from "@/features/pipeline/types";

type PipelineLeadCardProps = {
  lead: UiLead;
  onOpenEdit: (lead: UiLead) => void;
  onMovePrev: (lead: UiLead) => void;
  onMoveNext: (lead: UiLead) => void;
};

export function PipelineLeadCard({
  lead,
  onOpenEdit,
  onMovePrev,
  onMoveNext,
}: PipelineLeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `lead-${lead.id}`,
    data: { leadId: lead.id, fromStage: lead.stage },
  });

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-none shadow-sm hover:shadow-md transition-shadow group cursor-pointer bg-muted/10",
        isDragging && "opacity-60"
      )}
      onClick={() => onOpenEdit(lead)}
      title="Drag by handle or click to update stage/value"
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-bold leading-none mb-1">{lead.name}</div>
            <div className="text-[10px] text-muted-foreground font-medium">{lead.company}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              className="inline-flex items-center justify-center rounded-md h-6 w-6 text-muted-foreground hover:bg-background/80"
              aria-label="Drag card"
              onClick={(event) => event.stopPropagation()}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
            <Badge variant="outline" className="text-[10px] font-bold h-5 bg-background border-border/50">
              {lead.value}
            </Badge>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/10">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
            <Zap className="h-3 w-3 text-amber-500" />
            High Intent
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(event) => {
                event.stopPropagation();
                onMovePrev(lead);
              }}
              aria-label="Move to previous stage"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(event) => {
                event.stopPropagation();
                onMoveNext(lead);
              }}
              aria-label="Move to next stage"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <div className="text-[10px] text-muted-foreground">{lead.time}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

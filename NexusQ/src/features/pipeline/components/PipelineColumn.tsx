import { useDroppable } from "@dnd-kit/core";
import { MoreVertical, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PipelineLeadCard } from "@/features/pipeline/components/PipelineLeadCard";
import type { PipelineColumnView, UiLead } from "@/features/pipeline/types";

type PipelineColumnProps = {
  column: PipelineColumnView;
  onOpenEdit: (lead: UiLead) => void;
  onMovePrev: (lead: UiLead) => void;
  onMoveNext: (lead: UiLead) => void;
  onAddLead: () => void;
};

export function PipelineColumn({
  column,
  onOpenEdit,
  onMovePrev,
  onMoveNext,
  onAddLead,
}: PipelineColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id });

  return (
    <div className="w-[85vw] sm:w-[300px] flex flex-col space-y-4" role="region" aria-label={`${column.title} column`}>
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <div className={cn("h-2 w-2 rounded-full", column.color)} />
          <h3 className="font-bold text-sm uppercase tracking-wider">{column.title}</h3>
          <Badge
            variant="secondary"
            className="ml-1 text-[10px] h-4 px-1.5 bg-muted/50 text-muted-foreground"
          >
            {column.visibleCountLabel}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => toast.info(`${column.title} actions are available in the lead cards below.`)}
          aria-label={`${column.title} column actions`}
        >
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      <div
        ref={setNodeRef}
        role="region"
        aria-label={`${column.title} stage drop area`}
        className={cn(
          "space-y-3 rounded-xl p-1 transition-colors duration-150",
          isOver && "bg-primary/10 ring-1 ring-primary/30"
        )}
      >
        {column.leads.map((lead) => (
          <PipelineLeadCard
            key={lead.id}
            lead={lead}
            onOpenEdit={onOpenEdit}
            onMovePrev={onMovePrev}
            onMoveNext={onMoveNext}
          />
        ))}

        {!column.leads.length && (
          <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            No leads in {column.title} yet.
          </div>
        )}

        <Button
          variant="ghost"
          className="w-full border-2 border-dashed border-border/20 h-12 text-muted-foreground text-xs hover:border-border/50 hover:bg-muted/5"
          onClick={onAddLead}
        >
          <Plus className="h-3 w-3 mr-2" />
          Add Lead
        </Button>
      </div>
    </div>
  );
}

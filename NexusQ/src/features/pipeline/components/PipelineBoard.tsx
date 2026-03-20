import * as React from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { PipelineColumn } from "@/features/pipeline/components/PipelineColumn";
import type { PipelineColumnView, UiLead } from "@/features/pipeline/types";

type PipelineBoardProps = {
  sensors: React.ComponentProps<typeof DndContext>["sensors"];
  columns: PipelineColumnView[];
  activeDragLead: UiLead | null;
  onDragStart: React.ComponentProps<typeof DndContext>["onDragStart"];
  onDragOver: React.ComponentProps<typeof DndContext>["onDragOver"];
  onDragEnd: React.ComponentProps<typeof DndContext>["onDragEnd"];
  onDragCancel: React.ComponentProps<typeof DndContext>["onDragCancel"];
  onOpenEdit: (lead: UiLead) => void;
  onMovePrev: (lead: UiLead) => void;
  onMoveNext: (lead: UiLead) => void;
  onAddLead: () => void;
};

export function PipelineBoard({
  sensors,
  columns,
  activeDragLead,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragCancel,
  onOpenEdit,
  onMovePrev,
  onMoveNext,
  onAddLead,
}: PipelineBoardProps) {
  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <ScrollArea className="w-full whitespace-nowrap rounded-md border-none" aria-label="Pipeline stage board">
        <div className="flex w-max space-x-6 min-h-[600px]">
          {columns.map((column) => (
            <PipelineColumn
              key={column.id}
              column={column}
              onOpenEdit={onOpenEdit}
              onMovePrev={onMovePrev}
              onMoveNext={onMoveNext}
              onAddLead={onAddLead}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <DragOverlay>
        {activeDragLead ? (
          <Card className="w-[260px] border-none shadow-xl bg-card/95">
            <CardContent className="p-4 space-y-2">
              <div className="text-sm font-bold">{activeDragLead.name}</div>
              <div className="text-[10px] text-muted-foreground">{activeDragLead.company}</div>
              <Badge variant="outline" className="text-[10px]">
                {activeDragLead.value}
              </Badge>
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

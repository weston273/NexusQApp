import { Button } from "@/components/ui/button";

type PipelineResultsBarProps = {
  visibleLeadCount: number;
  filteredLeadCount: number;
  hiddenLeadCount: number;
  showAllLeads: boolean;
  onToggleShowAll: () => void;
};

export function PipelineResultsBar({
  visibleLeadCount,
  filteredLeadCount,
  hiddenLeadCount,
  showAllLeads,
  onToggleShowAll,
}: PipelineResultsBarProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
      <div className="text-xs text-muted-foreground">
        Showing {visibleLeadCount} of {filteredLeadCount} matching leads.
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-8"
        onClick={onToggleShowAll}
      >
        {showAllLeads ? "Show Less" : `Show More (${hiddenLeadCount})`}
      </Button>
    </div>
  );
}

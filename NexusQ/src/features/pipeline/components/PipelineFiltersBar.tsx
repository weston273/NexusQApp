import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PIPELINE_STAGES } from "@/lib/leads";
import type { PipelineStageFilter } from "@/features/pipeline/types";

type PipelineFiltersBarProps = {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  stageFilter: PipelineStageFilter;
  onStageFilterChange: (value: PipelineStageFilter) => void;
  filteredLeadCount: number;
  hasFiltersActive: boolean;
  onResetFilters: () => void;
};

export function PipelineFiltersBar({
  searchQuery,
  onSearchQueryChange,
  stageFilter,
  onStageFilterChange,
  filteredLeadCount,
  hasFiltersActive,
  onResetFilters,
}: PipelineFiltersBarProps) {
  return (
    <Card className="border-none bg-muted/20">
      <CardContent className="p-4 grid gap-4 lg:grid-cols-[1fr_auto] items-start">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search lead, phone, email, service, or address..."
              className="h-10 pl-9 bg-background"
              aria-label="Search pipeline leads"
            />
          </div>

          <Select value={stageFilter} onValueChange={(value) => onStageFilterChange(value as PipelineStageFilter)}>
            <SelectTrigger className="h-10 bg-background">
              <SelectValue placeholder="Filter by stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {PIPELINE_STAGES.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{filteredLeadCount} matching leads</span>
          <span className="hidden sm:inline">Drag cards or use arrows for quick movement.</span>
          {hasFiltersActive ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={onResetFilters}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

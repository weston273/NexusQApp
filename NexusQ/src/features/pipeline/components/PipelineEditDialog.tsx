import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PipelineMessageTimeline } from "@/features/pipeline/components/PipelineMessageTimeline";
import { formatCompactCurrency, formatDateTime, formatNullableText, type Lead, type PipelineRow, type PipelineStage } from "@/lib/leads";
import type { PipelineActiveLead, PipelineEventSummary } from "@/features/pipeline/types";

type PipelineEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  activeLead: PipelineActiveLead;
  activeLeadSource: Lead | null;
  activePipeline: PipelineRow | null;
  activeEventSummary: PipelineEventSummary;
  editStage: PipelineStage;
  onEditStageChange: (stage: PipelineStage) => void;
  editValue: string;
  onEditValueChange: (value: string) => void;
  parsedEditValue: number;
  onSave: () => void;
};

export function PipelineEditDialog({
  open,
  onOpenChange,
  saving,
  activeLead,
  activeLeadSource,
  activePipeline,
  activeEventSummary,
  editStage,
  onEditStageChange,
  editValue,
  onEditValueChange,
  parsedEditValue,
  onSave,
}: PipelineEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update Pipeline</DialogTitle>
          <DialogDescription>
            Edit the stage and quote/value for this lead. Saving will sync with the database.
            <br />
            <span className="text-xs text-muted-foreground">
              If credentials are missing, update backend connector configuration.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground">Lead</div>
            <div className="font-bold">{activeLead?.name ?? "-"}</div>
            <div className="text-[10px] text-muted-foreground">ID: {activeLead?.id ?? "-"}</div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-muted/10 p-3">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Lead Details</div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="text-right font-medium break-all">{formatNullableText(activeLeadSource?.phone)}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Email</span>
                  <span className="text-right font-medium break-all">{formatNullableText(activeLeadSource?.email)}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Service</span>
                  <span className="text-right font-medium">{formatNullableText(activeLeadSource?.service)}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Urgency</span>
                  <span className="text-right font-medium">{formatNullableText(activeLeadSource?.urgency)}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Address</span>
                  <span className="text-right font-medium break-words">{formatNullableText(activeLeadSource?.address)}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Source</span>
                  <span className="text-right font-medium">{formatNullableText(activeLeadSource?.source)}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Score</span>
                  <span className="text-right font-medium">{formatNullableText(activeLeadSource?.score)}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Status</span>
                  <span className="text-right font-medium">{formatNullableText(activeLeadSource?.status ?? activeLead?.stage)}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Created</span>
                  <span className="text-right font-medium">{formatDateTime(activeLeadSource?.created_at)}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Last Contacted</span>
                  <span className="text-right font-medium">{formatDateTime(activeLeadSource?.last_contacted_at)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/10 p-3 space-y-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Pipeline Snapshot</div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Current Stage</span>
                    <span className="text-right font-medium">{formatNullableText(activePipeline?.stage ?? activeLead?.stage)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Pipeline Value</span>
                    <span className="text-right font-medium">
                      ${formatCompactCurrency(Number(activePipeline?.value ?? activeLead?.valueNum ?? 0))}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Probability</span>
                    <span className="text-right font-medium">
                      {activePipeline?.probability == null ? "-" : `${activePipeline.probability}%`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Latest Activity</div>
                <div className="space-y-1 text-xs">
                  <div className="font-medium">{activeEventSummary.type}</div>
                  <div className="text-muted-foreground leading-relaxed">{activeEventSummary.detail}</div>
                  <div className="text-[10px] text-muted-foreground">{activeEventSummary.time}</div>
                </div>
              </div>

              <PipelineMessageTimeline leadId={activeLead?.id ?? null} open={open} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider">Stage</Label>
              <Select value={editStage} onValueChange={(value) => onEditStageChange(value as PipelineStage)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="qualifying">Qualifying</SelectItem>
                  <SelectItem value="quoted">Quoted</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider">Value (USD)</Label>
              <Input
                className="h-11"
                value={editValue}
                onChange={(event) => onEditValueChange(event.target.value)}
                inputMode="decimal"
                placeholder="e.g. 2500"
              />
              <div className="text-[10px] text-muted-foreground">
                Parsed: <span className="font-mono">${formatCompactCurrency(parsedEditValue)}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving || !activeLead}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

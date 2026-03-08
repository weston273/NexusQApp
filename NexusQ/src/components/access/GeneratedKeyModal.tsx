import { AlertTriangle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type GeneratedKeyModalProps = {
  open: boolean;
  rawKey: string | null;
  onClose: () => void;
  onCopy: () => Promise<void>;
  copiedConfirmed: boolean;
  onCopiedConfirmedChange: (value: boolean) => void;
};

export function GeneratedKeyModal({
  open,
  rawKey,
  onClose,
  onCopy,
  copiedConfirmed,
  onCopiedConfirmedChange,
}: GeneratedKeyModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && copiedConfirmed) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Access Key Generated</DialogTitle>
          <DialogDescription>
            Copy this key now. It will never be shown again and is not stored in plaintext.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-status-warning/40 bg-status-warning/10 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-status-warning">
            <AlertTriangle className="h-4 w-4" />
            Shown once only
          </div>
          <div className="font-mono text-xs break-all">{rawKey || "-"}</div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={copiedConfirmed}
            onChange={(event) => onCopiedConfirmedChange(event.target.checked)}
          />
          I have copied and stored this key securely.
        </label>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={() => void onCopy()}>
            <Copy className="h-4 w-4" />
            Copy key
          </Button>
          <Button type="button" onClick={onClose} disabled={!copiedConfirmed}>
            Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

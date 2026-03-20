import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SecuritySnapshot } from "@/features/health/types";
import { securityStatusClasses } from "@/features/health/utils";

export function HealthSecurityCard({ securitySnapshot }: { securitySnapshot: SecuritySnapshot }) {
  return (
    <Card className="border-none bg-muted/20">
      <CardHeader>
        <CardTitle className="text-lg">Security & Compliance</CardTitle>
        <CardDescription>
          Client-side transport posture and operator safety settings. Score {securitySnapshot.score}/100.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl border bg-background/60 p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Posture</div>
          <div className="mt-1 text-lg font-bold">{securitySnapshot.postureLabel}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            Checked {new Date(securitySnapshot.checkedAt).toLocaleString()}
          </div>
        </div>

        <div className="space-y-2">
          {securitySnapshot.checks.map((check) => (
            <div key={check.label} className="rounded-xl border bg-background/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold">{check.label}</div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${securityStatusClasses(check.status)}`}
                >
                  {check.status}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">{check.detail}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

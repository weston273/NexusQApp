import React from "react";

export function PageHeader({
  title,
  description,
  lastUpdatedLabel,
  actions,
}: {
  title: string;
  description: string;
  lastUpdatedLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        {lastUpdatedLabel ? <p className="text-[11px] text-muted-foreground mt-1">{lastUpdatedLabel}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

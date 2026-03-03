import React from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export function PageLoadingState({
  title = "Loading latest data",
  description = "Syncing operational state from live sources.",
  cardCount = 3,
}: {
  title?: string;
  description?: string;
  cardCount?: number;
}) {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
        <p className="sr-only">
          {title}. {description}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: cardCount }).map((_, index) => (
          <Card key={`loading-card-${index}`} className="border-none bg-muted/20">
            <CardContent className="p-5 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-2 w-4/5" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function PageErrorState({
  message,
  onRetry,
  title = "Unable to load data",
}: {
  message: string;
  onRetry: () => void;
  title?: string;
}) {
  return (
    <Card className="border-status-error/25 bg-status-error/5">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-status-error" />
          <div>
            <div className="text-sm font-bold text-status-error">{title}</div>
            <p className="text-xs text-muted-foreground mt-1">{message}</p>
          </div>
        </div>
        <Button size="sm" onClick={onRetry} className="h-9">
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

export function ActionEmptyState({
  title,
  description,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
}: {
  title: string;
  description: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}) {
  return (
    <Card className="border-dashed bg-muted/10">
      <CardContent className="p-2">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox className="h-4 w-4" />
            </EmptyMedia>
            <EmptyTitle>{title}</EmptyTitle>
            <EmptyDescription>{description}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="sm:flex-row sm:justify-center">
            <Button onClick={onPrimaryAction}>{primaryActionLabel}</Button>
            {secondaryActionLabel && onSecondaryAction ? (
              <Button variant="outline" onClick={onSecondaryAction}>
                {secondaryActionLabel}
              </Button>
            ) : null}
          </EmptyContent>
        </Empty>
      </CardContent>
    </Card>
  );
}


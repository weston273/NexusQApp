import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trackTelemetry } from "@/lib/telemetry";

type State = {
  hasError: boolean;
  message: string;
};

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || "Unexpected error" };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    trackTelemetry({
      type: "error",
      message: error.message,
      meta: { stack: error.stack, componentStack: errorInfo.componentStack },
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="p-8">
        <Card className="max-w-xl mx-auto border-destructive/30">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>
              The app hit an unexpected error. You can retry without losing app data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">{this.state.message}</div>
            <Button
              onClick={() => {
                this.setState({ hasError: false, message: "" });
                window.location.reload();
              }}
            >
              Reload Application
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
}

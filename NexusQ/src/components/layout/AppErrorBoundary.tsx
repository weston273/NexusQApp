import React from "react";
import { StartupFailure } from "@/components/layout/StartupFailure";
import { trackTelemetry } from "@/lib/telemetry";
import { isAppConfigError } from "@/lib/config";

type State = {
  hasError: boolean;
  message: string;
  error: Error | null;
};

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, message: "", error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || "Unexpected error", error };
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

    const details: string[] = [];
    let title = "Something went wrong";
    let description = "NexusQ hit an unexpected runtime error. You can reload without clearing local workspace data.";

    if (isAppConfigError(this.state.error)) {
      title = "Configuration problem detected";
      description = "NexusQ could not validate the required frontend configuration.";
    } else if (typeof navigator !== "undefined" && navigator.onLine === false) {
      title = "Network connection unavailable";
      description = "NexusQ lost connectivity while trying to render the app.";
      details.push("Reconnect the device to the network before retrying.");
    }

    if (this.state.message) {
      details.push(this.state.message);
    }

    return (
      <StartupFailure
        title={title}
        description={description}
        details={details}
        onAction={() => {
          this.setState({ hasError: false, message: "", error: null });
          window.location.reload();
        }}
      />
    );
  }
}

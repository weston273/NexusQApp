import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { AlertTriangle, RefreshCcw, Activity } from "lucide-react";
import Logo from "@/assets/logo/nexus-q-logo.png";
import { Button } from "@/components/ui/button";
import { trackTelemetry } from "@/lib/telemetry";

const MIN_VISIBLE_MS = 700;
const MAX_WAIT_MS = 6000;

const stages = [
  "Connecting data sources",
  "Loading leads and pipeline",
  "Preparing dashboards",
  "Calibrating intelligence",
  "Ready",
];

function deriveStageIndex(progress: number) {
  if (progress < 25) return 0;
  if (progress < 50) return 1;
  if (progress < 75) return 2;
  if (progress < 100) return 3;
  return 4;
}

export function SplashGate({
  children,
  ready,
  error,
  onRetry,
}: {
  children: React.ReactNode;
  ready: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = React.useState(true);
  const [progress, setProgress] = React.useState(8);
  const [timedOut, setTimedOut] = React.useState(false);
  const startedAtRef = React.useRef<number>(Date.now());
  const completedRef = React.useRef(false);
  const startedTrackedRef = React.useRef(false);

  const hasFailure = timedOut || !!error;
  const stageIndex = deriveStageIndex(progress);

  React.useLayoutEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  React.useEffect(() => {
    if (startedTrackedRef.current) return;
    startedTrackedRef.current = true;
    trackTelemetry({
      type: "ui",
      message: "startup_splash_started",
      meta: { at: new Date().toISOString() },
    });
  }, []);

  React.useEffect(() => {
    if (!visible || ready || hasFailure) return;
    const t = setInterval(() => {
      setProgress((prev) => Math.min(92, prev + (prev < 55 ? 2.5 : 1.2)));
    }, 220);
    return () => clearInterval(t);
  }, [visible, ready, hasFailure]);

  React.useEffect(() => {
    if (!visible) return;
    if (ready) return;
    const timeout = setTimeout(() => {
      setTimedOut(true);
      trackTelemetry({
        type: "error",
        message: "startup_splash_timeout",
        meta: { waitedMs: MAX_WAIT_MS },
      });
    }, MAX_WAIT_MS);
    return () => clearTimeout(timeout);
  }, [visible, ready]);

  React.useEffect(() => {
    if (!visible || hasFailure || !ready) return;
    setProgress(100);
    const elapsed = Date.now() - startedAtRef.current;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    const t = setTimeout(() => {
      setVisible(false);
      if (!completedRef.current) {
        completedRef.current = true;
        trackTelemetry({
          type: "ui",
          message: "startup_splash_completed",
          meta: { durationMs: Date.now() - startedAtRef.current },
        });
      }
    }, wait + 220);
    return () => clearTimeout(t);
  }, [visible, ready, hasFailure]);

  const continueToApp = () => {
    setVisible(false);
    trackTelemetry({
      type: "ui",
      message: "startup_splash_continue_to_app",
      meta: { reason: hasFailure ? "failure_override" : "manual" },
    });
  };

  const openHealth = () => {
    continueToApp();
    requestAnimationFrame(() => {
      window.history.pushState({}, "", "/health");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
  };

  const retryStartup = () => {
    setTimedOut(false);
    setProgress(14);
    startedAtRef.current = Date.now();
    trackTelemetry({
      type: "ui",
      message: "startup_splash_retry_clicked",
    });
    if (onRetry) {
      onRetry();
      return;
    }
    window.location.reload();
  };

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-background/95 backdrop-blur-sm"
            initial={{ opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, filter: "blur(3px)" }}
            transition={{ duration: 0.35 }}
            aria-live="polite"
            aria-busy={!ready}
          >
            <div className="w-full max-w-xl px-6">
              <div className="rounded-2xl border card-surface-a shadow-xl p-6 sm:p-8">
                <div className="flex items-center gap-4">
                  <motion.img
                    src={Logo}
                    alt="Nexus Q"
                    className="h-20 w-auto select-none"
                    animate={
                      reduceMotion
                        ? undefined
                        : {
                            y: [0, -2, 0],
                            filter: [
                              "drop-shadow(0 0 0px transparent)",
                              "drop-shadow(0 0 12px hsl(var(--primary)))",
                              "drop-shadow(0 0 0px transparent)",
                            ],
                          }
                    }
                    transition={reduceMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Nexus Q Operations</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      Syncing live pipeline, system health, and intelligence models.
                    </p>
                  </div>
                </div>

                {!hasFailure ? (
                  <div className="mt-6 space-y-4" role="status" aria-live="polite">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                        {stages[stageIndex]}
                      </span>
                      <span className="font-mono text-muted-foreground">{Math.round(progress)}%</span>
                    </div>
                    <div
                      className="h-2 w-full rounded-full bg-muted overflow-hidden"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(progress)}
                      aria-label="Application startup progress"
                    >
                      <motion.div
                        className="h-full bg-primary"
                        initial={false}
                        animate={{ width: `${progress}%` }}
                        transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: "easeOut" }}
                      />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {stages.map((stage, index) => (
                        <div
                          key={stage}
                          className={`rounded-md border px-2 py-1 text-[10px] text-center ${
                            index <= stageIndex
                              ? "bg-primary/15 border-primary/30 text-foreground"
                              : "bg-background/60 border-border text-muted-foreground"
                          }`}
                        >
                          {stage.split(" ")[0]}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 space-y-4" role="alert" aria-live="assertive">
                    <div className="rounded-xl border border-status-error/30 bg-status-error/10 p-4">
                      <div className="flex items-center gap-2 text-status-error font-semibold text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        Startup needs attention
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {error ||
                          "Initialization is taking longer than expected. You can retry or continue and inspect health directly."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={retryStartup} className="gap-2">
                        <RefreshCcw className="h-3.5 w-3.5" />
                        Retry
                      </Button>
                      <Button size="sm" variant="outline" onClick={openHealth} className="gap-2">
                        <Activity className="h-3.5 w-3.5" />
                        Open Health
                      </Button>
                      <Button size="sm" variant="ghost" onClick={continueToApp}>
                        Continue to App
                      </Button>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span>Demo Mode</span>
                  <span>{new Date().toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!visible ? (
        <motion.div
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      ) : null}
    </>
  );
}

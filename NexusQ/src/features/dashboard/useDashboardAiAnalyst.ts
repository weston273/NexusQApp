import * as React from "react";
import { useAuth } from "@/context/AuthProvider";
import { getErrorMessage } from "@/lib/errors";
import { askDashboardAiQuestion, fetchDashboardAiBriefing } from "@/features/dashboard/api";
import type { DashboardAiAnswer, DashboardAiBriefing, DashboardAiThreadItem } from "@/features/dashboard/types";

function createThreadItem(
  role: "user" | "assistant",
  content: string,
  answer?: DashboardAiAnswer | null
): DashboardAiThreadItem {
  return {
    id: `${role}-${crypto.randomUUID()}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    answer: answer ?? null,
  };
}

function buildPausedError(message: string) {
  return `${message} AI analysis is paused for this panel. Use Refresh Analysis to try again.`;
}

export function useDashboardAiAnalyst() {
  const { clientId } = useAuth();
  const [briefing, setBriefing] = React.useState<DashboardAiBriefing | null>(null);
  const [thread, setThread] = React.useState<DashboardAiThreadItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [asking, setAsking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = React.useState<Date | null>(null);
  const [paused, setPaused] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!clientId) {
      setBriefing(null);
      setThread([]);
      setError(null);
      setLastLoadedAt(null);
      setPaused(false);
      return;
    }

    setLoading(true);
    setPaused(false);
    try {
      const nextBriefing = await fetchDashboardAiBriefing(clientId);
      setBriefing(nextBriefing);
      setError(null);
      setLastLoadedAt(new Date());
      setPaused(false);
    } catch (loadError) {
      const message = getErrorMessage(loadError, "Failed to load AI workspace analysis.");
      setError(buildPausedError(message));
      setPaused(true);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  React.useEffect(() => {
    setBriefing(null);
    setThread([]);
    setError(null);
    setLastLoadedAt(null);
    setPaused(false);
    void refresh();
  }, [clientId, refresh]);

  const askQuestion = React.useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!clientId || !trimmed || paused) return null;

      const userTurn = createThreadItem("user", trimmed);
      const threadWithQuestion = [...thread, userTurn];
      setThread(threadWithQuestion);
      setAsking(true);

      try {
        const answer = await askDashboardAiQuestion({
          clientId,
          question: trimmed,
          history: threadWithQuestion,
        });
        const assistantTurn = createThreadItem("assistant", answer.answer, answer);
        setThread((current) => [...current, assistantTurn]);
        setError(null);
        setPaused(false);
        return answer;
      } catch (askError) {
        const message = getErrorMessage(askError, "Failed to answer your workspace question.");
        setError(buildPausedError(message));
        setPaused(true);
        setThread((current) => current.filter((item) => item.id !== userTurn.id));
        return null;
      } finally {
        setAsking(false);
      }
    },
    [clientId, paused, thread]
  );

  return {
    briefing,
    thread,
    loading,
    asking,
    paused,
    error,
    lastLoadedAt,
    refresh,
    askQuestion,
  };
}

import * as React from "react";
import { useAuth } from "@/context/AuthProvider";
import { getErrorMessage } from "@/lib/errors";
import { askDashboardAiQuestion, fetchDashboardAiBriefing } from "@/features/dashboard/api";
import {
  buildDashboardFallbackAnswer,
  buildDashboardFallbackBriefing,
  isDashboardAiRateLimited,
  type DashboardFallbackContext,
} from "@/features/dashboard/fallbackAnalyst";
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

export function useDashboardAiAnalyst(fallbackContext: DashboardFallbackContext | null) {
  const { clientId } = useAuth();
  const [briefing, setBriefing] = React.useState<DashboardAiBriefing | null>(null);
  const [thread, setThread] = React.useState<DashboardAiThreadItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [asking, setAsking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = React.useState<Date | null>(null);

  const refresh = React.useCallback(async () => {
    if (!clientId) {
      setBriefing(null);
      setError(null);
      setLastLoadedAt(null);
      return;
    }

    setLoading(true);
    try {
      const nextBriefing = await fetchDashboardAiBriefing(clientId);
      setBriefing(nextBriefing);
      setError(null);
      setLastLoadedAt(new Date());
    } catch (loadError) {
      const message = getErrorMessage(loadError, "Failed to load AI workspace analysis.");
      if (fallbackContext && isDashboardAiRateLimited(message)) {
        setBriefing(buildDashboardFallbackBriefing(fallbackContext));
        setError(null);
        setLastLoadedAt(new Date());
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [clientId, fallbackContext]);

  React.useEffect(() => {
    setThread([]);
    void refresh();
  }, [refresh]);

  const askQuestion = React.useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!clientId || !trimmed) return null;

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
        return answer;
      } catch (askError) {
        const message = getErrorMessage(askError, "Failed to answer your workspace question.");
        if (fallbackContext && isDashboardAiRateLimited(message)) {
          const fallbackAnswer = buildDashboardFallbackAnswer(fallbackContext, trimmed);
          const assistantTurn = createThreadItem("assistant", fallbackAnswer.answer, fallbackAnswer);
          setThread((current) => [...current, assistantTurn]);
          setError(null);
          return fallbackAnswer;
        }
        setError(message);
        setThread((current) => current.filter((item) => item.id !== userTurn.id));
        return null;
      } finally {
        setAsking(false);
      }
    },
    [clientId, fallbackContext, thread]
  );

  return {
    briefing,
    thread,
    loading,
    asking,
    error,
    lastLoadedAt,
    refresh,
    askQuestion,
  };
}

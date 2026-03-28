export const DASHBOARD_AI_MAX_FAILURES = 5;
export const DASHBOARD_AI_COOLDOWN_MS = 5 * 60 * 1000;

export type DashboardAiCircuitState = {
  failureCount: number;
  cooldownUntil: number | null;
};

export function createDashboardAiCircuitState(): DashboardAiCircuitState {
  return {
    failureCount: 0,
    cooldownUntil: null,
  };
}

export function normalizeDashboardAiCircuitState(
  state: DashboardAiCircuitState | null | undefined,
  now = Date.now()
) {
  if (!state) {
    return createDashboardAiCircuitState();
  }

  if (state.cooldownUntil != null && state.cooldownUntil <= now) {
    return createDashboardAiCircuitState();
  }

  return state;
}

export function isDashboardAiCircuitOpen(state: DashboardAiCircuitState | null | undefined, now = Date.now()) {
  const normalized = normalizeDashboardAiCircuitState(state, now);
  return normalized.cooldownUntil != null && normalized.cooldownUntil > now;
}

export function getDashboardAiCircuitCooldownRemainingMs(
  state: DashboardAiCircuitState | null | undefined,
  now = Date.now()
) {
  const normalized = normalizeDashboardAiCircuitState(state, now);
  if (normalized.cooldownUntil == null) return 0;
  return Math.max(0, normalized.cooldownUntil - now);
}

export function recordDashboardAiCircuitFailure(
  state: DashboardAiCircuitState | null | undefined,
  now = Date.now()
) {
  const normalized = normalizeDashboardAiCircuitState(state, now);
  if (normalized.cooldownUntil != null && normalized.cooldownUntil > now) {
    return normalized;
  }

  const failureCount = normalized.failureCount + 1;
  if (failureCount >= DASHBOARD_AI_MAX_FAILURES) {
    return {
      failureCount: 0,
      cooldownUntil: now + DASHBOARD_AI_COOLDOWN_MS,
    } satisfies DashboardAiCircuitState;
  }

  return {
    failureCount,
    cooldownUntil: null,
  } satisfies DashboardAiCircuitState;
}

export function recordDashboardAiCircuitSuccess() {
  return createDashboardAiCircuitState();
}

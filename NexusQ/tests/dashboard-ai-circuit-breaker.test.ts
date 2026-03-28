import test from "node:test";
import assert from "node:assert/strict";
import {
  DASHBOARD_AI_COOLDOWN_MS,
  DASHBOARD_AI_MAX_FAILURES,
  createDashboardAiCircuitState,
  getDashboardAiCircuitCooldownRemainingMs,
  isDashboardAiCircuitOpen,
  normalizeDashboardAiCircuitState,
  recordDashboardAiCircuitFailure,
  recordDashboardAiCircuitSuccess,
} from "../supabase/functions/_shared/dashboard-ai-circuit-breaker.ts";

test("dashboard ai circuit opens after the configured failure budget", () => {
  const start = Date.UTC(2026, 2, 28, 8, 0, 0);
  let state = createDashboardAiCircuitState();

  for (let attempt = 1; attempt < DASHBOARD_AI_MAX_FAILURES; attempt += 1) {
    state = recordDashboardAiCircuitFailure(state, start + attempt);
    assert.equal(isDashboardAiCircuitOpen(state, start + attempt), false);
    assert.equal(state.failureCount, attempt);
  }

  state = recordDashboardAiCircuitFailure(state, start + DASHBOARD_AI_MAX_FAILURES);
  assert.equal(isDashboardAiCircuitOpen(state, start + DASHBOARD_AI_MAX_FAILURES), true);
  assert.equal(state.failureCount, 0);
  assert.equal(getDashboardAiCircuitCooldownRemainingMs(state, start + DASHBOARD_AI_MAX_FAILURES), DASHBOARD_AI_COOLDOWN_MS);
});

test("dashboard ai circuit resets after cooldown expiry or success", () => {
  const start = Date.UTC(2026, 2, 28, 8, 5, 0);
  let state = createDashboardAiCircuitState();
  let openedAt = start;

  for (let attempt = 0; attempt < DASHBOARD_AI_MAX_FAILURES; attempt += 1) {
    openedAt = start + attempt;
    state = recordDashboardAiCircuitFailure(state, openedAt);
  }

  const afterCooldown = openedAt + DASHBOARD_AI_COOLDOWN_MS + 1;
  const cooled = normalizeDashboardAiCircuitState(state, afterCooldown);
  assert.equal(isDashboardAiCircuitOpen(cooled, afterCooldown), false);
  assert.equal(cooled.failureCount, 0);
  assert.equal(cooled.cooldownUntil, null);

  const reset = recordDashboardAiCircuitSuccess();
  assert.equal(reset.failureCount, 0);
  assert.equal(reset.cooldownUntil, null);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  formatSupabaseAuthErrorMessage,
  isGoogleProviderDisabledMessage,
} from "../src/lib/auth-messages.ts";

test("google provider disabled messages are recognized", () => {
  assert.equal(isGoogleProviderDisabledMessage("Unsupported provider: provider is not enabled"), true);
  assert.equal(isGoogleProviderDisabledMessage("provider is not enabled"), true);
  assert.equal(isGoogleProviderDisabledMessage("Invalid login credentials"), false);
});

test("friendly Supabase auth messaging explains how to enable Google sign-in", () => {
  const message = formatSupabaseAuthErrorMessage("Unsupported provider: provider is not enabled", {
    redirectTo: "http://localhost:3000/auth/callback",
  });

  assert.match(message, /Google sign-in is not enabled/i);
  assert.match(message, /Supabase Auth/i);
  assert.match(message, /http:\/\/localhost:3000\/auth\/callback/i);
});

import test from "node:test";
import assert from "node:assert/strict";
import { AppConfigError, buildSupabaseFunctionUrl, getAppConfig, readAppConfig } from "../src/lib/config.ts";

test("config reader accepts valid required env and normalizes the Supabase URL", () => {
  const result = readAppConfig({
    VITE_SUPABASE_URL: "https://example.supabase.co/",
    VITE_SUPABASE_ANON_KEY: "anon-key-value",
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    throw result.error;
  }

  assert.equal(result.data.supabaseUrl, "https://example.supabase.co");
  assert.equal(result.data.supabaseAnonKey, "anon-key-value");
});

test("config reader reports missing required env values and invalid optional URLs", () => {
  const result = readAppConfig({
    VITE_SUPABASE_URL: "not-a-url",
    VITE_PASSWORD_RESET_REDIRECT_URL: "/reset-password",
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail("Expected config validation to fail.");
  }

  assert.equal(result.error instanceof AppConfigError, true);
  assert.deepEqual(
    result.error.issues.map((issue) => issue.key).sort(),
    ["VITE_PASSWORD_RESET_REDIRECT_URL", "VITE_SUPABASE_ANON_KEY", "VITE_SUPABASE_URL"]
  );
});

test("config reader rejects example placeholder values", () => {
  const result = readAppConfig({
    VITE_SUPABASE_URL: "https://your-project-ref.supabase.co",
    VITE_SUPABASE_ANON_KEY: "your-anon-key",
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail("Expected placeholder config to fail validation.");
  }

  assert.match(result.error.message, /real project value/i);
});

test("buildSupabaseFunctionUrl uses validated config and trims duplicate slashes", () => {
  const url = buildSupabaseFunctionUrl("/workflow-e-proxy", {
    VITE_SUPABASE_URL: "https://example.supabase.co///",
    VITE_SUPABASE_ANON_KEY: "anon-key-value",
  });

  assert.equal(url, "https://example.supabase.co/functions/v1/workflow-e-proxy");
});

test("getAppConfig throws AppConfigError for invalid env", () => {
  assert.throws(
    () =>
      getAppConfig({
        VITE_SUPABASE_URL: "",
        VITE_SUPABASE_ANON_KEY: "",
      }),
    (error: unknown) => {
      assert.equal(error instanceof AppConfigError, true);
      return true;
    }
  );
});

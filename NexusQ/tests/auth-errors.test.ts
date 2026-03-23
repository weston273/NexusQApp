import test from "node:test";
import assert from "node:assert/strict";
import {
  InvalidSessionStateError,
  MissingSessionError,
  isInvalidSessionStateError,
  isMissingSessionError,
  isSessionInvalidMessage,
} from "../src/lib/auth-errors.ts";

test("auth error helpers distinguish signed-out state from invalid saved sessions", () => {
  const signedOut = new MissingSessionError();
  const invalid = new InvalidSessionStateError();

  assert.equal(isMissingSessionError(signedOut), true);
  assert.equal(isMissingSessionError(invalid), false);
  assert.equal(isInvalidSessionStateError(invalid), true);
  assert.equal(isInvalidSessionStateError(signedOut), false);
});

test("auth error helpers recognize invalid Supabase session messages but not a normal signed-out state", () => {
  assert.equal(isSessionInvalidMessage("Invalid Refresh Token: Already Used"), true);
  assert.equal(isSessionInvalidMessage("Session from session_id claim in JWT does not exist"), true);
  assert.equal(isSessionInvalidMessage("You are not signed in. Please sign in again."), false);
});

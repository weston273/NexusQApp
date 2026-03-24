import test from "node:test";
import assert from "node:assert/strict";
import { normalizeE164PhoneInput } from "../src/lib/phone.ts";

test("phone helper normalizes valid E.164 inputs", () => {
  assert.equal(normalizeE164PhoneInput(" +1 (555) 123-4567 "), "+15551234567");
  assert.equal(normalizeE164PhoneInput("+263771234567"), "+263771234567");
});

test("phone helper rejects invalid operator phone inputs", () => {
  assert.equal(normalizeE164PhoneInput("0771234567"), null);
  assert.equal(normalizeE164PhoneInput("+0123456789"), null);
  assert.equal(normalizeE164PhoneInput(""), null);
});

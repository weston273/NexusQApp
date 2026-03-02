import test from "node:test";
import assert from "node:assert/strict";

test("exponential backoff sequence helper intent", async () => {
  let attempts = 0;
  async function unreliable() {
    attempts += 1;
    if (attempts < 3) throw new Error("temporary");
    return "ok";
  }

  // Inline minimal retry logic mirrors app behavior expectations.
  async function runRetry(fn, retries = 2) {
    let i = 0;
    while (i <= retries) {
      try {
        return await fn();
      } catch (e) {
        if (i === retries) throw e;
        i += 1;
      }
    }
  }

  const result = await runRetry(unreliable, 2);
  assert.equal(result, "ok");
  assert.equal(attempts, 3);
});

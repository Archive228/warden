import { assertEquals, assertRejects } from "@std/assert";
import { withRetry } from "./retry.ts";

Deno.test("withRetry returns the result once the function succeeds", async () => {
  let attempts = 0;
  const result = await withRetry(() => {
    attempts++;
    if (attempts < 3) throw new Error("simulated 429");
    return Promise.resolve("ok");
  }, { retries: 3, baseDelayMs: 1 });

  assertEquals(result, "ok");
  assertEquals(attempts, 3);
});

Deno.test("withRetry gives up and throws the last error after exhausting retries", async () => {
  let attempts = 0;
  await assertRejects(
    () =>
      withRetry(() => {
        attempts++;
        throw new Error("always fails");
      }, { retries: 2, baseDelayMs: 1 }),
    Error,
    "always fails",
  );
  assertEquals(attempts, 3); // initial try + 2 retries
});

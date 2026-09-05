import { assertEquals, assertRejects } from "@std/assert";
import { judgeLaunch, saveVerdictLog } from "./judge.ts";
import type { LaunchScan } from "../chain/pons.ts";

// Real model calls need ANTHROPIC_API_KEY, which this environment doesn't
// have (checked: not set, and the Claude Code session's own credentials
// are a separate thing from this tool's - not something to smuggle in).
// This at least proves the failure mode is a clean, actionable error
// rather than a crash - the actual live call is unverified until someone
// adds a real key to .env, see claude-progress.txt.
Deno.test("judgeLaunch fails clearly, not silently, without an API key", async () => {
  const originalKey = Deno.env.get("ANTHROPIC_API_KEY");
  Deno.env.delete("ANTHROPIC_API_KEY");
  try {
    await assertRejects(
      () => judgeLaunch({ token: "0x0", exists: false }, null),
      Error,
      "ANTHROPIC_API_KEY",
    );
  } finally {
    if (originalKey) Deno.env.set("ANTHROPIC_API_KEY", originalKey);
  }
});

Deno.test("saveVerdictLog writes a readable file and returns its path", async () => {
  const verdict = {
    category: "insufficient_data" as const,
    confidence: 0.1,
    summary: "test",
    signalsWeighed: ["test=true"],
    reasoningLog: "test",
  };
  const path = await saveVerdictLog("0xTEST", verdict);
  try {
    const contents = JSON.parse(await Deno.readTextFile(path));
    assertEquals(contents.token, "0xTEST");
    assertEquals(contents.verdict.category, "insufficient_data");
  } finally {
    await Deno.remove(path);
  }
});

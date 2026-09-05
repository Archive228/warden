import { assertStringIncludes } from "@std/assert";
import { formatVerdictMessage } from "./format.ts";

Deno.test("formatVerdictMessage includes the category, confidence, summary, token, and every signal", () => {
  const message = formatVerdictMessage("0xTOKEN", {
    category: "high_risk",
    confidence: 0.87,
    summary: "This looks like a promotional wrapper, not a real launch.",
    signalsWeighed: [
      "lpLocked=false (phase=2, post-graduation, so this is meaningful)",
      "tickerMentions=1 ($BODKIN in bio)",
    ],
    reasoningLog: "unused in the formatted message",
  });

  assertStringIncludes(message, "HIGH RISK");
  assertStringIncludes(message, "87% confidence");
  assertStringIncludes(message, "promotional wrapper");
  assertStringIncludes(message, "0xTOKEN");
  assertStringIncludes(message, "lpLocked=false");
  assertStringIncludes(message, "$BODKIN");
});

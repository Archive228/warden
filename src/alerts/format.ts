import type { Verdict } from "../judge/judge.ts";

const CATEGORY_EMOJI: Record<Verdict["category"], string> = {
  high_risk: "\u{1F534}",
  moderate_risk: "\u{1F7E1}",
  low_risk: "\u{1F7E2}",
  insufficient_data: "\u{26AA}",
};

export function formatVerdictMessage(token: string, verdict: Verdict): string {
  const label = verdict.category.replace("_", " ").toUpperCase();
  const confidencePct = Math.round(verdict.confidence * 100);
  const signals = verdict.signalsWeighed.map((s) => `• ${s}`).join("\n");

  return [
    `${
      CATEGORY_EMOJI[verdict.category]
    } *${label}* (${confidencePct}% confidence)`,
    "",
    verdict.summary,
    "",
    `Token: \`${token}\``,
    "",
    "Signals:",
    signals,
  ].join("\n");
}

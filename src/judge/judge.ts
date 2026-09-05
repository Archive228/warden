import Anthropic from "@anthropic-ai/sdk";
import type { LaunchScan } from "../chain/pons.ts";
import type { RepoFingerprint } from "../repo/fingerprint.ts";

const DEFAULT_MODEL = "claude-sonnet-5";

export type VerdictCategory =
  | "high_risk"
  | "moderate_risk"
  | "low_risk"
  | "insufficient_data";

export interface Verdict {
  category: VerdictCategory;
  confidence: number;
  summary: string;
  signalsWeighed: string[];
  reasoningLog: string;
}

const RECORD_VERDICT_TOOL: Anthropic.Tool = {
  name: "record_verdict",
  description: "Record the vetting verdict for this token launch.",
  input_schema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        enum: ["high_risk", "moderate_risk", "low_risk", "insufficient_data"],
      },
      confidence: {
        type: "number",
        description:
          "0 to 1. Use insufficient_data with low confidence when key signals are missing, rather than guessing.",
      },
      summary: {
        type: "string",
        description:
          "One paragraph, plain language, no jargon - the verdict a non-technical reader could act on.",
      },
      signalsWeighed: {
        type: "array",
        items: { type: "string" },
        description:
          "Each entry cites a SPECIFIC field and value from the provided data, e.g. 'lpLocked=false (but phase=0, pre-graduation, so this is expected, not a red flag)'. Never a vague claim with no cited field.",
      },
      reasoningLog: {
        type: "string",
        description:
          "Full reasoning connecting the cited signals to the verdict category.",
      },
    },
    required: [
      "category",
      "confidence",
      "summary",
      "signalsWeighed",
      "reasoningLog",
    ],
  },
};

// Context the model would otherwise have to re-derive (badly, or not at
// all) every call. Each line here corresponds to a real bug or a real
// false-positive this project caught in its own on-chain/repo readers -
// see claude-progress.txt for the sessions that found each one.
const SYSTEM_PROMPT =
  `You are warden's vetting judge. You are given the raw on-chain scan of a new token launch and, if available, an authenticity fingerprint of a GitHub repo linked to it.

Rules:
- Reason ONLY from the data given. Never invent a fact not present in the input.
- Every entry in signalsWeighed must cite a specific field and its actual value from the input.
- If repoFingerprint is null, say so explicitly in your reasoning ("no linked repo was provided") - never assume that means the project is clean.
- Known context you must apply, not re-derive:
  - lpLocked=false is EXPECTED and not a red flag when phase=0 (pre-graduation) - there is no LP to lock yet. Only treat lpLocked=false as meaningful once phase>0.
  - contractAddressMentions in a repo's README/bio is a WEAK signal alone - legitimate protocol-integration repos are full of real contract addresses. Only tickerMentions ($XXXX-style) is a meaningfully strong self-promotion signal.
  - snipeTaxBps returning 0 is expected once past the launch's decay window (typically already true by the time anyone can query it) - it is not evidence of anything by itself.
  - devBuy.available=false means the check could not be completed (e.g. an RPC error), NOT that dev buys are confirmed absent. Treat it as missing data, not a clean signal.
  - holders=null means holder data could not be fetched, not zero concentration.
  - starTimingAvailable=false is a GitHub API restriction, not a signal - never treat it as "no star burst found."
- Call record_verdict exactly once with your conclusion.`;

export async function judgeLaunch(
  scan: LaunchScan,
  repoFingerprint: RepoFingerprint | null,
): Promise<Verdict> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set - add it to .env before running judge",
    );
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: Deno.env.get("WARDEN_MODEL") ?? DEFAULT_MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    tools: [RECORD_VERDICT_TOOL],
    tool_choice: { type: "tool", name: "record_verdict" },
    messages: [
      {
        role: "user",
        content: JSON.stringify(
          { scan, repoFingerprint },
          (_key, value) => typeof value === "bigint" ? value.toString() : value,
        ),
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("model did not call record_verdict");
  }

  return toolUse.input as Verdict;
}

export async function saveVerdictLog(
  token: string,
  verdict: Verdict,
): Promise<string> {
  await Deno.mkdir("verdicts", { recursive: true });
  const path = `verdicts/${token}-${Date.now()}.json`;
  await Deno.writeTextFile(path, JSON.stringify({ token, verdict }, null, 2));
  return path;
}

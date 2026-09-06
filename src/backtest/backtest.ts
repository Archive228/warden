import type { Address } from "viem";
import type { RobinhoodClient } from "../chain/client.ts";
import { scanLaunch } from "../chain/pons.ts";
import { judgeLaunch, type Verdict } from "../judge/judge.ts";
import { type ActualOutcome, classifyOutcome } from "./outcome.ts";
import { findHistoricalLaunches } from "./discover.ts";

export interface BacktestEntry {
  token: Address;
  launchedAt: string;
  actualOutcome: ActualOutcome;
  verdict: Verdict | null;
  verdictError: string | null;
}

export async function runBacktest(
  client: RobinhoodClient,
  since: Date,
): Promise<BacktestEntry[]> {
  const historical = await findHistoricalLaunches(client, since);
  const entries: BacktestEntry[] = [];

  for (const launch of historical) {
    const scan = await scanLaunch(client, launch.token);
    if (!scan.exists) continue;

    const daysSinceLaunch = (Date.now() - launch.launchedAt.getTime()) /
      (1000 * 60 * 60 * 24);
    const actualOutcome = classifyOutcome(scan, daysSinceLaunch);

    let verdict: Verdict | null = null;
    let verdictError: string | null = null;
    try {
      verdict = await judgeLaunch(scan, null);
    } catch (err) {
      verdictError = err instanceof Error ? err.message : String(err);
    }

    entries.push({
      token: launch.token,
      launchedAt: launch.launchedAt.toISOString(),
      actualOutcome,
      verdict,
      verdictError,
    });
  }

  return entries;
}

export interface BacktestSummary {
  totalHistoricalLaunches: number;
  verdictsAvailable: number;
  verdictsUnavailable: number;
  // Only populated from entries where a real verdict exists - never
  // fabricated from the ones that failed. If verdictsAvailable is 0, every
  // count here is legitimately 0, not "unknown."
  lowRiskGraduated: number;
  lowRiskAbandoned: number;
  highRiskGraduated: number;
  highRiskAbandoned: number;
}

export function summarizeBacktest(entries: BacktestEntry[]): BacktestSummary {
  const summary: BacktestSummary = {
    totalHistoricalLaunches: entries.length,
    verdictsAvailable: 0,
    verdictsUnavailable: 0,
    lowRiskGraduated: 0,
    lowRiskAbandoned: 0,
    highRiskGraduated: 0,
    highRiskAbandoned: 0,
  };

  for (const entry of entries) {
    if (!entry.verdict) {
      summary.verdictsUnavailable++;
      continue;
    }
    summary.verdictsAvailable++;

    const graduated = entry.actualOutcome.label === "graduated";
    const abandoned = entry.actualOutcome.label === "abandoned";

    if (entry.verdict.category === "low_risk" && graduated) {
      summary.lowRiskGraduated++;
    }
    if (entry.verdict.category === "low_risk" && abandoned) {
      summary.lowRiskAbandoned++;
    }
    if (entry.verdict.category === "high_risk" && graduated) {
      summary.highRiskGraduated++;
    }
    if (entry.verdict.category === "high_risk" && abandoned) {
      summary.highRiskAbandoned++;
    }
  }

  return summary;
}

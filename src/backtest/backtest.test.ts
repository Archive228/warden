import { assertEquals } from "@std/assert";
import { type BacktestEntry, summarizeBacktest } from "./backtest.ts";

function entry(overrides: Partial<BacktestEntry>): BacktestEntry {
  return {
    token: "0xToken",
    launchedAt: new Date().toISOString(),
    actualOutcome: { label: "indeterminate", evidence: "test" },
    verdict: null,
    verdictError: null,
    ...overrides,
  };
}

Deno.test("summarizeBacktest: never fabricates counts for entries with no verdict", () => {
  const summary = summarizeBacktest([
    entry({ verdict: null, verdictError: "no api key" }),
    entry({ verdict: null, verdictError: "no api key" }),
  ]);
  assertEquals(summary.totalHistoricalLaunches, 2);
  assertEquals(summary.verdictsAvailable, 0);
  assertEquals(summary.verdictsUnavailable, 2);
  assertEquals(summary.lowRiskGraduated, 0);
  assertEquals(summary.highRiskGraduated, 0);
});

Deno.test("summarizeBacktest: cross-tabulates verdict category against actual outcome correctly", () => {
  const lowRiskVerdict = {
    category: "low_risk" as const,
    confidence: 0.9,
    summary: "",
    signalsWeighed: [],
    reasoningLog: "",
  };
  const highRiskVerdict = { ...lowRiskVerdict, category: "high_risk" as const };

  const summary = summarizeBacktest([
    entry({
      verdict: lowRiskVerdict,
      actualOutcome: { label: "graduated", evidence: "" },
    }),
    entry({
      verdict: lowRiskVerdict,
      actualOutcome: { label: "abandoned", evidence: "" },
    }),
    entry({
      verdict: highRiskVerdict,
      actualOutcome: { label: "graduated", evidence: "" },
    }),
    entry({
      verdict: highRiskVerdict,
      actualOutcome: { label: "abandoned", evidence: "" },
    }),
    entry({
      verdict: highRiskVerdict,
      actualOutcome: { label: "abandoned", evidence: "" },
    }),
  ]);

  assertEquals(summary.verdictsAvailable, 5);
  assertEquals(summary.lowRiskGraduated, 1);
  assertEquals(summary.lowRiskAbandoned, 1);
  assertEquals(summary.highRiskGraduated, 1);
  assertEquals(summary.highRiskAbandoned, 2);
});

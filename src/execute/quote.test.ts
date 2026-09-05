import { assertEquals } from "@std/assert";
import { applySlippageFloor, estimateTokensOut } from "./quote.ts";

Deno.test("estimateTokensOut matches PonsV2BondingCurve.buy()'s exact arithmetic on hand-computable numbers", () => {
  // fee=10 (1% of 1000), tax=20 (2% of 1000), netIn=970
  // tokensOut = (970 * 100000) / (10000 + 970) = 97_000_000 / 10970 = 8842 (floored)
  const result = estimateTokensOut(1000n, 100n, 200n, 10_000n, 100_000n);
  assertEquals(result, 8842n);
});

Deno.test("estimateTokensOut returns 0 rather than throwing on empty reserves", () => {
  assertEquals(estimateTokensOut(1000n, 100n, 200n, 0n, 100_000n), 0n);
  assertEquals(estimateTokensOut(1000n, 100n, 200n, 10_000n, 0n), 0n);
});

Deno.test("estimateTokensOut returns 0 when fees alone consume the entire input", () => {
  // feeBps + creatorTaxBps >= 10000 -> netIn <= 0
  assertEquals(estimateTokensOut(1000n, 6000n, 5000n, 10_000n, 100_000n), 0n);
});

Deno.test("applySlippageFloor: 3% tolerance on a round number", () => {
  assertEquals(applySlippageFloor(1000n, 300n), 970n);
});

Deno.test("applySlippageFloor: 0 bps tolerance returns the input unchanged", () => {
  assertEquals(applySlippageFloor(12345n, 0n), 12345n);
});

// This exact scenario (quoteIn 0.001 ETH, these reserves) was cross-checked
// live against a real deployed curve via simulateContract - the contract's
// own return value matched this function's output exactly, 0 bps
// difference. Recorded here as a fixed regression, not re-verified live on
// every test run (reserves drift constantly on a real curve).
Deno.test("estimateTokensOut matches a real on-chain simulateContract result captured live", () => {
  const quoteIn = 1_000_000_000_000_000n; // 0.001 ETH
  const feeBps = 100n;
  const creatorTaxBps = 411n;
  const quoteReserve = 1_680_000_000_000_000_000n;
  const tokenReserve = 1_000_000_000_000_000_000_000_000_000n;

  const result = estimateTokensOut(
    quoteIn,
    feeBps,
    creatorTaxBps,
    quoteReserve,
    tokenReserve,
  );
  assertEquals(result, 564_502_585_414_702_374_355_341n);
});

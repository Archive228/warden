// Replicates PonsV2BondingCurve.buy()'s exact arithmetic (read from the
// real source, not reverse-engineered from behavior): fee and creatorTax
// are deducted from quoteIn FIRST, then the remainder is priced through
// PonsV2BondingCurveMath's constant-product formula with feeBps=0 - fee is
// NOT applied a second time inside that formula. Order matters for
// matching the contract's rounding; this is used to compute a slippage
// floor, not to move money on its own.
export function estimateTokensOut(
  quoteIn: bigint,
  feeBps: bigint,
  creatorTaxBps: bigint,
  quoteReserve: bigint,
  tokenReserve: bigint,
): bigint {
  const fee = (quoteIn * feeBps) / 10_000n;
  const tax = (quoteIn * creatorTaxBps) / 10_000n;
  const netIn = quoteIn - fee - tax;
  if (netIn <= 0n || quoteReserve <= 0n || tokenReserve <= 0n) return 0n;
  return (netIn * tokenReserve) / (quoteReserve + netIn);
}

export function applySlippageFloor(
  amount: bigint,
  slippageBps: bigint,
): bigint {
  return (amount * (10_000n - slippageBps)) / 10_000n;
}

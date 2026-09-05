import { parseEther } from "viem";
import type { LaunchScan } from "../chain/pons.ts";
import type { Verdict } from "../judge/judge.ts";
import { createWardenWallet, executeBuy } from "./buy.ts";
import { applySlippageFloor, estimateTokensOut } from "./quote.ts";
import type { TradeDecision } from "./tradelog.ts";

export const ZERO_ADDRESS = `0x${"0".repeat(40)}` as const;

export interface TradeOptions {
  live: boolean;
  minConfidence: number;
  buyAmountEth: string;
  slippageBps: number;
}

type ExistingScan = Extract<LaunchScan, { exists: true }>;

// The safety gate for real money. Every path returns a TradeDecision -
// there is no path where a launch is silently skipped without a reason
// recorded. Order matters: verdict and pair-type are checked BEFORE
// --live is even consulted, so a dry-run decision reads the same reason a
// live run would have hit, rather than always saying "dry-run" first.
export async function decideTrade(
  scan: ExistingScan,
  verdict: Verdict,
  opts: TradeOptions,
  deps: {
    createWallet: typeof createWardenWallet;
    executeBuy: typeof executeBuy;
  } = { createWallet: createWardenWallet, executeBuy },
): Promise<TradeDecision> {
  const base = {
    token: scan.token,
    timestamp: new Date().toISOString(),
    verdictCategory: verdict.category,
    verdictConfidence: verdict.confidence,
    liveMode: opts.live,
  };

  const clears = verdict.category === "low_risk" &&
    verdict.confidence >= opts.minConfidence;

  if (!clears) {
    return {
      ...base,
      attempted: false,
      reason:
        `verdict ${verdict.category} @ ${verdict.confidence} does not clear low_risk @ >=${opts.minConfidence}`,
    };
  }

  if (scan.pairToken.toLowerCase() !== ZERO_ADDRESS) {
    return {
      ...base,
      attempted: false,
      reason:
        `launch is paired with ERC20 ${scan.pairToken}, not native ETH - only the native-ETH buy() path is implemented`,
    };
  }

  if (!opts.live) {
    return {
      ...base,
      attempted: false,
      reason: "dry-run: would attempt buy, but --live was not passed",
    };
  }

  const quoteIn = parseEther(opts.buyAmountEth);
  const estimated = estimateTokensOut(
    quoteIn,
    scan.feeBps,
    scan.creatorTaxBps,
    scan.quoteReserve,
    scan.tokenReserve,
  );
  const minTokensOut = applySlippageFloor(estimated, BigInt(opts.slippageBps));

  try {
    const wallet = deps.createWallet(undefined);
    const plan = {
      curve: scan.curve,
      quoteIn,
      minTokensOut,
      recipient: wallet.account.address,
    };
    const txHash = await deps.executeBuy(wallet, plan);
    return {
      ...base,
      attempted: true,
      reason: "live buy submitted",
      txHash,
      quoteInWei: quoteIn.toString(),
      minTokensOut: minTokensOut.toString(),
    };
  } catch (err) {
    return {
      ...base,
      attempted: false,
      reason: `live buy failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
      quoteInWei: quoteIn.toString(),
      minTokensOut: minTokensOut.toString(),
    };
  }
}

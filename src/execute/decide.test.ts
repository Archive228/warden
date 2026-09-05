import { assertEquals, assertStringIncludes } from "@std/assert";
import { decideTrade, ZERO_ADDRESS } from "./decide.ts";
import type { LaunchScan } from "../chain/pons.ts";
import type { Verdict } from "../judge/judge.ts";

const NON_ZERO_ADDRESS = `0x${"1".repeat(40)}` as const;

function fakeScan(
  overrides: Partial<Extract<LaunchScan, { exists: true }>> = {},
): Extract<LaunchScan, { exists: true }> {
  return {
    token: "0xToken",
    exists: true,
    curve: "0xCurve",
    deployer: "0xDeployer",
    creatorFeeRecipient: "0xCreator",
    pairToken: ZERO_ADDRESS,
    graduationThreshold: 4_200_000_000_000_000_000n,
    creatorTaxBpsAtLaunch: 200,
    phase: 0,
    name: "Test",
    symbol: "TEST",
    totalSupply: 1_000_000_000_000_000_000_000_000_000n,
    decimals: 18,
    quoteReserve: 1_000_000_000_000_000_000n,
    tokenReserve: 900_000_000_000_000_000_000_000_000n,
    realQuoteReserve: 500_000_000_000_000_000n,
    progress: 0.12,
    readyToGraduate: false,
    graduated: false,
    feeBps: 100n,
    creatorTaxBps: 200n,
    snipeTaxBps: 0n,
    lpLocked: false,
    lockedTokenSupply: 0n,
    devBuy: { available: true, buyCount: 0, totalQuoteIn: 0n },
    tokenTemplate: {
      mintFunctionExists: false,
      blacklistFunctionExists: false,
      deployerHasPrivileges: false,
    },
    ...overrides,
    // deno-lint-ignore no-explicit-any
  } as any;
}

function fakeVerdict(overrides: Partial<Verdict> = {}): Verdict {
  return {
    category: "low_risk",
    confidence: 0.9,
    summary: "test",
    signalsWeighed: [],
    reasoningLog: "test",
    ...overrides,
  };
}

const baseOpts = {
  live: false,
  minConfidence: 0.8,
  buyAmountEth: "0.01",
  slippageBps: 300,
};

Deno.test("decideTrade: does not attempt when verdict is not low_risk, even with --live", async () => {
  const decision = await decideTrade(
    fakeScan(),
    fakeVerdict({ category: "high_risk", confidence: 0.95 }),
    { ...baseOpts, live: true },
  );
  assertEquals(decision.attempted, false);
  assertStringIncludes(decision.reason, "high_risk");
});

Deno.test("decideTrade: does not attempt when confidence is below the threshold, even with --live", async () => {
  const decision = await decideTrade(
    fakeScan(),
    fakeVerdict({ category: "low_risk", confidence: 0.5 }),
    { ...baseOpts, live: true, minConfidence: 0.8 },
  );
  assertEquals(decision.attempted, false);
  assertStringIncludes(decision.reason, "0.5");
});

Deno.test("decideTrade: does not attempt on an ERC20-paired launch, even when verdict clears and --live is on", async () => {
  const decision = await decideTrade(
    fakeScan({ pairToken: NON_ZERO_ADDRESS }),
    fakeVerdict(),
    { ...baseOpts, live: true },
  );
  assertEquals(decision.attempted, false);
  assertStringIncludes(decision.reason, "ERC20");
  assertStringIncludes(decision.reason, NON_ZERO_ADDRESS);
});

Deno.test("decideTrade: does not attempt without --live even when verdict clears every other gate", async () => {
  const decision = await decideTrade(fakeScan(), fakeVerdict(), {
    ...baseOpts,
    live: false,
  });
  assertEquals(decision.attempted, false);
  assertStringIncludes(decision.reason, "dry-run");
});

Deno.test("decideTrade: attempts a real buy only when every gate clears with --live, and logs the tx hash", async () => {
  let calledWith: unknown = null;
  const fakeWallet = { account: { address: "0xMyWallet" } };
  const decision = await decideTrade(
    fakeScan(),
    fakeVerdict(),
    { ...baseOpts, live: true },
    {
      // deno-lint-ignore no-explicit-any
      createWallet: (() => fakeWallet) as any,
      executeBuy: ((_wallet: unknown, plan: unknown) => {
        calledWith = plan;
        return Promise.resolve("0xTxHash");
        // deno-lint-ignore no-explicit-any
      }) as any,
    },
  );

  assertEquals(decision.attempted, true);
  assertEquals(decision.txHash, "0xTxHash");
  assertEquals(
    (calledWith as { recipient: string }).recipient,
    "0xMyWallet",
  );
  assertEquals((calledWith as { curve: string }).curve, "0xCurve");
});

Deno.test("decideTrade: a failed buy (e.g. missing wallet key) is recorded as not attempted, not thrown", async () => {
  const decision = await decideTrade(
    fakeScan(),
    fakeVerdict(),
    { ...baseOpts, live: true },
    {
      createWallet: () => {
        throw new Error("WALLET_PRIVATE_KEY is not set");
      },
      // deno-lint-ignore no-explicit-any
      executeBuy: (() => Promise.resolve("0xShouldNotHappen")) as any,
    },
  );

  assertEquals(decision.attempted, false);
  assertStringIncludes(decision.reason, "WALLET_PRIVATE_KEY");
});

Deno.test("decideTrade: every decision, attempted or not, carries the verdict that triggered it", async () => {
  const decision = await decideTrade(
    fakeScan(),
    fakeVerdict({ category: "moderate_risk", confidence: 0.3 }),
    baseOpts,
  );
  assertEquals(decision.verdictCategory, "moderate_risk");
  assertEquals(decision.verdictConfidence, 0.3);
  assertEquals(typeof decision.timestamp, "string");
});

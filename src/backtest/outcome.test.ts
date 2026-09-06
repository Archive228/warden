import { assertEquals } from "@std/assert";
import { classifyOutcome } from "./outcome.ts";
import type { LaunchScan } from "../chain/pons.ts";

function fakeScan(
  overrides: Partial<Extract<LaunchScan, { exists: true }>>,
): Extract<LaunchScan, { exists: true }> {
  return {
    token: "0xToken",
    exists: true,
    curve: "0xCurve",
    deployer: "0xDeployer",
    creatorFeeRecipient: "0xCreator",
    pairToken: `0x${"0".repeat(40)}`,
    graduationThreshold: 1n,
    creatorTaxBpsAtLaunch: 0,
    phase: 0,
    name: "Test",
    symbol: "TEST",
    totalSupply: 1n,
    decimals: 18,
    quoteReserve: 0n,
    tokenReserve: 0n,
    realQuoteReserve: 0n,
    progress: 0,
    readyToGraduate: false,
    graduated: false,
    feeBps: 0n,
    creatorTaxBps: 0n,
    snipeTaxBps: null,
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

Deno.test("classifyOutcome: graduated is graduated regardless of age", () => {
  const outcome = classifyOutcome(fakeScan({ graduated: true, phase: 2 }), 1);
  assertEquals(outcome.label, "graduated");
});

Deno.test("classifyOutcome: too young to call, even with near-zero progress", () => {
  const outcome = classifyOutcome(
    fakeScan({ graduated: false, progress: 0.001 }),
    2,
  );
  assertEquals(outcome.label, "indeterminate");
});

Deno.test("classifyOutcome: old and stalled is abandoned", () => {
  const outcome = classifyOutcome(
    fakeScan({ graduated: false, progress: 0.01 }),
    30,
  );
  assertEquals(outcome.label, "abandoned");
});

Deno.test("classifyOutcome: old but with real progress is active, not abandoned", () => {
  const outcome = classifyOutcome(
    fakeScan({ graduated: false, progress: 0.5 }),
    30,
  );
  assertEquals(outcome.label, "active");
});

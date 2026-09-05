import { assertEquals, assertThrows } from "@std/assert";
import { parseEther } from "viem";
import { createRobinhoodClient } from "../chain/client.ts";
import { scanLaunch } from "../chain/pons.ts";
import { createWardenWallet, simulateBuy } from "./buy.ts";
import { applySlippageFloor, estimateTokensOut } from "./quote.ts";

const PROBE_ACCOUNT = `0x${"0".repeat(39)}1` as const;

Deno.test("createWardenWallet fails clearly, not silently, without a private key", () => {
  const saved = Deno.env.get("WALLET_PRIVATE_KEY");
  Deno.env.delete("WALLET_PRIVATE_KEY");
  try {
    assertThrows(
      () => createWardenWallet(),
      Error,
      "WALLET_PRIVATE_KEY",
    );
  } finally {
    if (saved) Deno.env.set("WALLET_PRIVATE_KEY", saved);
  }
});

Deno.test({
  name:
    "simulateBuy: a real buy() call against a live native-ETH-paired curve succeeds via eth_call, spending nothing",
  fn: async () => {
    const client = createRobinhoodClient();

    // Finds a live, non-graduated, native-ETH-paired launch itself rather
    // than hardcoding one address that will eventually graduate or age out
    // - same reasoning as the on-chain reader's own tests.
    const latest = await client.getBlockNumber();
    const { ponsV2FactoryAbi, PONS_V2_FACTORY_ADDRESS } = await import(
      "../chain/abi/factory.ts"
    );
    const logs = await client.getContractEvents({
      address: PONS_V2_FACTORY_ADDRESS,
      abi: ponsV2FactoryAbi,
      eventName: "TokenLaunched",
      fromBlock: latest - 6_000n,
      toBlock: latest,
    });

    let tested = false;
    for (const log of logs) {
      const token = log.args.token;
      if (!token) continue;
      const scan = await scanLaunch(client, token);
      if (
        !scan.exists || scan.graduated ||
        scan.pairToken !== `0x${"0".repeat(40)}`
      ) {
        continue;
      }

      const quoteIn = parseEther("0.001");
      const estimated = estimateTokensOut(
        quoteIn,
        scan.feeBps,
        scan.creatorTaxBps,
        scan.quoteReserve,
        scan.tokenReserve,
      );
      const minTokensOut = applySlippageFloor(estimated, 300n);

      const result = await simulateBuy(
        client,
        { curve: scan.curve, quoteIn, minTokensOut, recipient: PROBE_ACCOUNT },
        PROBE_ACCOUNT,
      );
      assertEquals(result.result >= minTokensOut, true);
      tested = true;
      break;
    }

    if (!tested) {
      console.log(
        "no live non-graduated native-paired launch found in the lookback window - inconclusive, not failed",
      );
    }
  },
});

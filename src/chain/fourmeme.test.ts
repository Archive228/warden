import { assertEquals } from "@std/assert";
import { createBscClient } from "./bscClient.ts";
import { scanFourMemeLaunch, toLaunchpadScan } from "./fourmeme.ts";

// Constructed, not hand-typed, so its length can't be miscounted - same
// pattern as the Pons/Robinhood tests.
const NEVER_LAUNCHED = `0x${"0".repeat(39)}1` as const;

Deno.test("BNB Smart Chain RPC reports chain id 56", async () => {
  const client = createBscClient();
  assertEquals(await client.getChainId(), 56);
});

Deno.test("scanFourMemeLaunch reports exists:false for an address that never launched", async () => {
  const client = createBscClient();
  const scan = await scanFourMemeLaunch(client, NEVER_LAUNCHED);
  assertEquals(scan.exists, false);
});

Deno.test("scanFourMemeLaunch reads a real live native-BNB-paired launch, owner is the manager pre-graduation", async () => {
  const client = createBscClient();
  const scan = await scanFourMemeLaunch(
    client,
    "0x0a75210672cd91d22562695631c0bd131942ffff",
  );
  assertEquals(scan.exists, true);
  if (!scan.exists) return;

  assertEquals(scan.quote, "0x0000000000000000000000000000000000000000");
  assertEquals(scan.maxFunds, 18_000_000_000_000_000_000n); // 18 BNB, native default
  // Structurally true for any non-graduated four.meme launch, not just
  // this one: TokenManager2 holds Ownable control while a token is on the
  // curve. A false here (without graduation) would be the real anomaly.
  if (!scan.graduated) {
    assertEquals(scan.ownerPrivilegeActive, true);
    assertEquals(
      scan.ownerAddress.toLowerCase(),
      "0x5c952063c7fc8610ffdb798152d69f0b9550762b",
    );
  }
});

Deno.test("scanFourMemeLaunch reads a real live ERC20-quoted launch (not every launch is native-paired, same as Pons)", async () => {
  const client = createBscClient();
  const scan = await scanFourMemeLaunch(
    client,
    "0x94dcc8c75b5105c770ccf51c445eb757d2daffff",
  );
  assertEquals(scan.exists, true);
  if (!scan.exists) return;
  assertEquals(
    scan.quote !== "0x0000000000000000000000000000000000000000",
    true,
  );
});

Deno.test("toLaunchpadScan on a real live four.meme launch produces the same field shape as Pons's normalizer", async () => {
  const client = createBscClient();
  const scan = await scanFourMemeLaunch(
    client,
    "0x0a75210672cd91d22562695631c0bd131942ffff",
  );
  assertEquals(scan.exists, true);
  if (!scan.exists) return;

  const normalized = toLaunchpadScan(scan);
  const expectedKeys = [
    "launchpad",
    "token",
    "exists",
    "name",
    "symbol",
    "totalSupply",
    "decimals",
    "quoteAsset",
    "progress",
    "graduated",
    "feeBps",
    "lpLocked",
    "lpLockMechanism",
    "ownerPrivilege",
  ].sort();
  assertEquals(Object.keys(normalized).sort(), expectedKeys);
  assertEquals(normalized.launchpad, "four-meme");
});

// Spot-checks the burn-detection arithmetic against a specific graduated
// pair a prior research pass already identified and reported as ~100%
// burned - this project's own RPC hit query-limit errors trying to
// rediscover a graduated launch itself (BSC's overall PancakeSwap volume
// is too high for a public RPC's eth_getLogs window), so this verifies
// the calculation against a known real pair rather than a self-discovered
// one. Still real chain state, not a fixture.
Deno.test("LP-burn arithmetic matches a known graduated pair's real on-chain balances", async () => {
  const client = createBscClient();
  const pair = "0xf49d9C79A07922D3846C762c73b4df65205Ef772" as const;
  const { erc20MinimalAbi } = await import("./abi/erc20.ts");
  const balanceOfAbi = [{
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  }] as const;

  const [totalSupply, deadBalance, zeroBalance] = await Promise.all([
    client.readContract({
      address: pair,
      abi: erc20MinimalAbi,
      functionName: "totalSupply",
    }),
    client.readContract({
      address: pair,
      abi: balanceOfAbi,
      functionName: "balanceOf",
      args: ["0x000000000000000000000000000000000000dead"],
    }),
    client.readContract({
      address: pair,
      abi: balanceOfAbi,
      functionName: "balanceOf",
      args: ["0x0000000000000000000000000000000000000000"],
    }),
  ]);

  const burnedFraction =
    Number(((deadBalance + zeroBalance) * 10_000n) / totalSupply) / 10_000;
  assertEquals(burnedFraction >= 0.99, true);
});

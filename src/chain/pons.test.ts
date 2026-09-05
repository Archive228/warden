import { assertEquals } from "@std/assert";
import { createRobinhoodClient } from "./client.ts";
import { scanLaunch } from "./pons.ts";
import { PONS_V2_FACTORY_ADDRESS, ponsV2FactoryAbi } from "./abi/factory.ts";

// Constructed rather than hand-typed, so its length (0x + 40 hex) can't be
// miscounted: an address that has certainly never launched anything.
const NEVER_LAUNCHED = `0x${"0".repeat(39)}1` as const;

Deno.test("Robinhood Chain RPC reports chain id 4663", async () => {
  const client = createRobinhoodClient();
  assertEquals(await client.getChainId(), 4663);
});

Deno.test("factory.canLaunch resolves to a boolean without throwing", async () => {
  const client = createRobinhoodClient();
  const result = await client.readContract({
    address: PONS_V2_FACTORY_ADDRESS,
    abi: ponsV2FactoryAbi,
    functionName: "canLaunch",
    args: [NEVER_LAUNCHED],
  });
  assertEquals(typeof result, "boolean");
});

Deno.test("scanLaunch reports exists:false for an address that never launched", async () => {
  const client = createRobinhoodClient();
  const scan = await scanLaunch(client, NEVER_LAUNCHED);
  assertEquals(scan.exists, false);
});

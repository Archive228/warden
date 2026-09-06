import { assertEquals } from "@std/assert";
import { isAddress } from "viem";
import { createRobinhoodClient } from "../chain/client.ts";
import { findHistoricalLaunches } from "./discover.ts";

Deno.test("findHistoricalLaunches finds real launches in a short recent window", async () => {
  const client = createRobinhoodClient();
  // A short window - launches happen frequently enough on this factory
  // (hundreds/hour at times, per this project's own earlier research)
  // that even 10 minutes should find at least one, without putting heavy
  // load on a public RPC this session has already used a great deal.
  const since = new Date(Date.now() - 10 * 60 * 1000);
  const launches = await findHistoricalLaunches(client, since);

  assertEquals(launches.length > 0, true);
  for (const launch of launches) {
    assertEquals(isAddress(launch.token), true);
    assertEquals(isAddress(launch.curve), true);
    assertEquals(launch.launchedAt.getTime() >= since.getTime(), true);
  }
});

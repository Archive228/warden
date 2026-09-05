import { assertEquals } from "@std/assert";
import { isAddress } from "viem";
import { createRobinhoodClient } from "../chain/client.ts";
import { findNewLaunchesSince, watchLaunches } from "./watch.ts";

Deno.test("findNewLaunchesSince finds real TokenLaunched events in a recent block range", async () => {
  const client = createRobinhoodClient();
  const latest = await client.getBlockNumber();
  // Pons v2 launches happen frequently enough (observed: hundreds in a
  // 13-minute window during this project's own research) that a ~10-minute
  // lookback (100ms blocks) should reliably contain at least one, without
  // hardcoding a token address that will eventually age out of relevance.
  const { tokens, latestBlock } = await findNewLaunchesSince(
    client,
    latest - 6_000n,
  );

  assertEquals(latestBlock >= latest, true);
  assertEquals(tokens.length > 0, true);
  assertEquals(tokens.every((t) => isAddress(t)), true);
});

Deno.test("watchLaunches stops promptly when its signal is aborted, without polling", async () => {
  const client = createRobinhoodClient();
  const controller = new AbortController();
  controller.abort();

  let onLaunchCalls = 0;
  await watchLaunches(client, () => {
    onLaunchCalls++;
    return Promise.resolve();
  }, { signal: controller.signal, pollIntervalMs: 50 });

  assertEquals(onLaunchCalls, 0);
});

Deno.test("watchLaunches calls onError instead of throwing when onLaunch fails", async () => {
  // Real launch timing is out of this test's control, so this uses a fake
  // client shaped like just the two methods findNewLaunchesSince actually
  // calls - deterministic, no live RPC, no dependence on something
  // launching in a narrow real-time window.
  let block = 100n;
  const fakeClient = {
    getBlockNumber: () => Promise.resolve(++block),
    getContractEvents: () =>
      Promise.resolve([
        { args: { token: "0x0000000000000000000000000000000000dEaD" } },
      ]),
    // deno-lint-ignore no-explicit-any
  } as any;

  const controller = new AbortController();
  const errors: unknown[] = [];

  const timer = setTimeout(() => controller.abort(), 30);
  await watchLaunches(
    fakeClient,
    () => Promise.reject(new Error("simulated judge/telegram failure")),
    {
      signal: controller.signal,
      pollIntervalMs: 5,
      onError: (e) => errors.push(e),
    },
  );
  clearTimeout(timer);

  assertEquals(errors.length > 0, true);
  assertEquals(
    (errors[0] as Error).message,
    "simulated judge/telegram failure",
  );
});

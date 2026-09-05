import type { Address } from "viem";
import type { RobinhoodClient } from "../chain/client.ts";
import {
  PONS_V2_FACTORY_ADDRESS,
  ponsV2FactoryAbi,
} from "../chain/abi/factory.ts";

export async function findNewLaunchesSince(
  client: RobinhoodClient,
  sinceBlock: bigint,
): Promise<{ tokens: Address[]; latestBlock: bigint }> {
  const latestBlock = await client.getBlockNumber();
  if (latestBlock <= sinceBlock) return { tokens: [], latestBlock };

  const logs = await client.getContractEvents({
    address: PONS_V2_FACTORY_ADDRESS,
    abi: ponsV2FactoryAbi,
    eventName: "TokenLaunched",
    fromBlock: sinceBlock + 1n,
    toBlock: latestBlock,
  });

  const tokens = logs
    .map((log) => log.args.token)
    .filter((t): t is Address => t != null);

  return { tokens, latestBlock };
}

export interface WatchOptions {
  pollIntervalMs?: number;
  signal?: AbortSignal;
  onError?: (err: unknown) => void;
}

export async function watchLaunches(
  client: RobinhoodClient,
  onLaunch: (token: Address) => Promise<void>,
  { pollIntervalMs = 15_000, signal, onError }: WatchOptions = {},
): Promise<void> {
  let lastBlock = await client.getBlockNumber();

  while (!signal?.aborted) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    if (signal?.aborted) break;

    try {
      const { tokens, latestBlock } = await findNewLaunchesSince(
        client,
        lastBlock,
      );
      lastBlock = latestBlock;

      for (const token of tokens) {
        try {
          await onLaunch(token);
        } catch (err) {
          // One bad launch (a failed judge call, a Telegram outage) must
          // not kill a process meant to run for hours unattended.
          onError?.(err);
        }
      }
    } catch (err) {
      onError?.(err);
    }
  }
}

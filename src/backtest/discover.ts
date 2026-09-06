import type { Address } from "viem";
import type { RobinhoodClient } from "../chain/client.ts";
import {
  PONS_V2_FACTORY_ADDRESS,
  ponsV2FactoryAbi,
} from "../chain/abi/factory.ts";

export interface HistoricalLaunch {
  token: Address;
  curve: Address;
  launchedAt: Date;
  blockNumber: bigint;
}

const CHUNK_BLOCKS = 5_000n;
const MAX_CHUNKS = 200; // safety cap - ~1M blocks, well beyond any reasonable --since

// Chunked, walking backward from latest, because a wide eth_getLogs range
// against this factory can exceed the RPC's own result-count limit at
// this contract's real activity level (hit -32005 "exceeds limit of
// 10000" querying it directly earlier in this project, at peak it did
// 400+ TokenLaunched events in 13 minutes). Stops once a chunk's own block
// timestamp is older than `since`, not on a fixed block-count estimate -
// block time drifts and shouldn't be trusted as exactly 100ms over a long
// lookback.
export async function findHistoricalLaunches(
  client: RobinhoodClient,
  since: Date,
): Promise<HistoricalLaunch[]> {
  const launches: HistoricalLaunch[] = [];
  const sinceMs = since.getTime();

  let toBlock = await client.getBlockNumber();
  let chunks = 0;

  while (chunks < MAX_CHUNKS) {
    chunks++;
    const fromBlock = toBlock > CHUNK_BLOCKS ? toBlock - CHUNK_BLOCKS : 0n;

    const [logs, fromBlockInfo] = await Promise.all([
      client.getContractEvents({
        address: PONS_V2_FACTORY_ADDRESS,
        abi: ponsV2FactoryAbi,
        eventName: "TokenLaunched",
        fromBlock,
        toBlock,
      }),
      client.getBlock({ blockNumber: fromBlock }),
    ]);

    // Only fetch per-log timestamps for logs in this chunk, not one call
    // per historical block across the whole search - the chunk boundary
    // timestamp already tells us whether to keep going.
    for (const log of logs) {
      if (!log.args.token || !log.args.curve || log.blockNumber == null) {
        continue;
      }
      const block = await client.getBlock({ blockNumber: log.blockNumber });
      const launchedAt = new Date(Number(block.timestamp) * 1000);
      if (launchedAt.getTime() < sinceMs) continue;
      launches.push({
        token: log.args.token,
        curve: log.args.curve,
        launchedAt,
        blockNumber: log.blockNumber,
      });
    }

    if (Number(fromBlockInfo.timestamp) * 1000 < sinceMs || fromBlock === 0n) {
      break;
    }
    toBlock = fromBlock - 1n;
  }

  return launches;
}

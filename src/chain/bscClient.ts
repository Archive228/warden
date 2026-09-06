import { createPublicClient, http } from "viem";
import { bscChain } from "./bscChain.ts";

export function createBscClient(rpcUrl?: string) {
  return createPublicClient({
    chain: bscChain,
    transport: http(rpcUrl ?? bscChain.rpcUrls.default.http[0]),
  });
}

export type BscClient = ReturnType<typeof createBscClient>;

import { createPublicClient, http } from "viem";
import { robinhoodChain } from "./robinhoodChain.ts";

export function createRobinhoodClient(rpcUrl?: string) {
  return createPublicClient({
    chain: robinhoodChain,
    transport: http(rpcUrl ?? robinhoodChain.rpcUrls.default.http[0]),
  });
}

export type RobinhoodClient = ReturnType<typeof createRobinhoodClient>;

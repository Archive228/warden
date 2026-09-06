import { type Address, zeroAddress } from "viem";
import type { BscClient } from "./bscClient.ts";
import { erc20MinimalAbi } from "./abi/erc20.ts";
import {
  FOUR_MEME_HELPER_V3,
  FOUR_MEME_TOKEN_MANAGER_V2,
  fourMemeHelperAbi,
  fourMemeTokenManagerAbi,
  ownableAbi,
  PANCAKESWAP_V2_FACTORY,
  pancakeV2FactoryAbi,
  WBNB_ADDRESS,
} from "./abi/fourmeme.ts";
import type { LaunchpadScan } from "./launchpad.ts";
import { withRetry } from "../util/retry.ts";

const DEAD_ADDRESS = "0x000000000000000000000000000000000000dead" as const;
const LAUNCHPAD = "four-meme" as const;

const balanceOfAbi = [{
  inputs: [{ internalType: "address", name: "", type: "address" }],
  name: "balanceOf",
  outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
  stateMutability: "view",
  type: "function",
}] as const;

export type FourMemeScan =
  | { launchpad: "four-meme"; token: Address; exists: false }
  | {
    launchpad: "four-meme";
    token: Address;
    exists: true;
    version: bigint;
    tokenManager: Address;
    quote: Address;
    tradingFeeRate: bigint;
    funds: bigint;
    maxFunds: bigint;
    graduated: boolean;
    name: string;
    symbol: string;
    totalSupply: bigint;
    decimals: number;
    lpPair: Address | null;
    lpLocked: boolean | null;
    ownerAddress: Address;
    ownerPrivilegeActive: boolean;
  };

export async function scanFourMemeLaunch(
  client: BscClient,
  token: Address,
): Promise<FourMemeScan> {
  let info;
  try {
    info = await withRetry(() =>
      client.readContract({
        address: FOUR_MEME_HELPER_V3,
        abi: fourMemeHelperAbi,
        functionName: "getTokenInfo",
        args: [token],
      })
    );
  } catch {
    return { launchpad: LAUNCHPAD, token, exists: false };
  }

  const [
    version,
    tokenManager,
    quote,
    ,
    tradingFeeRate,
    ,
    ,
    ,
    ,
    funds,
    maxFunds,
    liquidityAdded,
  ] = info;

  // version 0 with maxFunds 0 is how this helper reports "never a
  // four.meme token" - there's no `exists` field the way Pons's factory
  // struct has one.
  if (maxFunds === 0n) {
    return { launchpad: LAUNCHPAD, token, exists: false };
  }

  const tokenContract = { address: token, abi: erc20MinimalAbi } as const;

  const [name, symbol, totalSupply, decimals, ownerAddress] = await withRetry(
    () =>
      Promise.all([
        client.readContract({ ...tokenContract, functionName: "name" }),
        client.readContract({ ...tokenContract, functionName: "symbol" }),
        client.readContract({
          ...tokenContract,
          functionName: "totalSupply",
        }),
        client.readContract({ ...tokenContract, functionName: "decimals" }),
        client.readContract({
          address: token,
          abi: ownableAbi,
          functionName: "owner",
        }),
      ]),
  );

  // four.meme's own design has TokenManager2 hold Ownable control WHILE a
  // token is on the curve - that's expected, not a red flag, unlike Pons
  // where the deployer never has any privilege at any phase. Only owner
  // != 0 AFTER graduation is the actual anomaly here (interpreted in
  // toLaunchpadScan, not here - this just records the raw fact).
  const ownerPrivilegeActive = ownerAddress.toLowerCase() !== zeroAddress;

  const { lpPair, lpLocked } = await fetchLpLockStatus(client, token, quote);

  return {
    launchpad: LAUNCHPAD,
    token,
    exists: true,
    version,
    tokenManager,
    quote,
    tradingFeeRate,
    funds,
    maxFunds,
    graduated: liquidityAdded,
    name,
    symbol,
    totalSupply,
    decimals,
    lpPair,
    lpLocked,
    ownerAddress,
    ownerPrivilegeActive,
  };
}

async function fetchLpLockStatus(
  client: BscClient,
  token: Address,
  quote: Address,
): Promise<{ lpPair: Address | null; lpLocked: boolean | null }> {
  // No locker contract exists for four.meme (unlike Pons's dedicated
  // vault) - graduation burns ~100% of LP to the dead address instead.
  // "Locked" here means "look up the real PancakeSwap pair and check who
  // holds its LP tokens," not a per-token lock-registry read.
  const pairAsset = quote.toLowerCase() === zeroAddress ? WBNB_ADDRESS : quote;

  let pair: Address;
  try {
    pair = await withRetry(() =>
      client.readContract({
        address: PANCAKESWAP_V2_FACTORY,
        abi: pancakeV2FactoryAbi,
        functionName: "getPair",
        args: [token, pairAsset],
      })
    );
  } catch {
    return { lpPair: null, lpLocked: null };
  }

  if (pair.toLowerCase() === zeroAddress) {
    // Not graduated yet (or graduated through some other path) - no pair
    // exists to check, which is a different state than "checked and
    // found unlocked."
    return { lpPair: null, lpLocked: null };
  }

  try {
    const pairContract = { address: pair, abi: erc20MinimalAbi } as const;
    const [totalSupply, deadBalance, zeroBalance] = await withRetry(() =>
      Promise.all([
        client.readContract({ ...pairContract, functionName: "totalSupply" }),
        client.readContract({
          address: pair,
          abi: balanceOfAbi,
          functionName: "balanceOf",
          args: [DEAD_ADDRESS],
        }),
        client.readContract({
          address: pair,
          abi: balanceOfAbi,
          functionName: "balanceOf",
          args: [zeroAddress],
        }),
      ])
    );

    if (totalSupply === 0n) return { lpPair: pair, lpLocked: null };
    // >=99% burned counts as locked - leaves room for the fixed 1000-wei
    // MINIMUM_LIQUIDITY every Uniswap-v2-style pair permanently burns to
    // address(0) on first mint, which is protocol dust, not a real holder.
    const burnedFraction =
      Number(((deadBalance + zeroBalance) * 10_000n) / totalSupply) / 10_000;
    return { lpPair: pair, lpLocked: burnedFraction >= 0.99 };
  } catch {
    return { lpPair: pair, lpLocked: null };
  }
}

export function toLaunchpadScan(
  scan: Extract<FourMemeScan, { exists: true }>,
): Extract<LaunchpadScan, { exists: true }> {
  return {
    launchpad: scan.launchpad,
    token: scan.token,
    exists: true,
    name: scan.name,
    symbol: scan.symbol,
    totalSupply: scan.totalSupply,
    decimals: scan.decimals,
    quoteAsset: scan.quote,
    progress: scan.maxFunds > 0n
      ? Number((scan.funds * 10_000n) / scan.maxFunds) / 10_000
      : 0,
    graduated: scan.graduated,
    feeBps: Number(scan.tradingFeeRate),
    lpLocked: scan.lpLocked,
    lpLockMechanism: scan.lpPair ? "burn" : "unavailable",
    ownerPrivilege: {
      checked: true,
      active: scan.ownerPrivilegeActive,
      expectedRightNow: !scan.graduated,
    },
  };
}

export { FOUR_MEME_TOKEN_MANAGER_V2, fourMemeTokenManagerAbi };

import type { Address } from "viem";
import type { RobinhoodClient } from "./client.ts";
import { ponsV2CurveAbi } from "./abi/curve.ts";
import { erc20MinimalAbi } from "./abi/erc20.ts";
import { PONS_V2_FACTORY_ADDRESS, ponsV2FactoryAbi } from "./abi/factory.ts";
import {
  PONS_V2_LAUNCH_LOCKER_ADDRESS,
  ponsV2LaunchLockerAbi,
} from "./abi/locker.ts";

// Every Pons v2 launch uses the same immutable token template
// (PonsV2LauncherToken.sol, read in full): plain OpenZeppelin ERC20 +
// ERC20Burnable, the only _mint call is in the constructor, and the
// deployer address carries zero on-chain privileges. So these are fixed
// facts about the protocol, not a per-token check.
export const PONS_V2_TOKEN_TEMPLATE = {
  mintFunctionExists: false,
  blacklistFunctionExists: false,
  deployerHasPrivileges: false,
} as const;

export interface DevBuy {
  buyCount: number;
  totalQuoteIn: bigint;
}

export type LaunchScan =
  | { token: Address; exists: false }
  | {
    token: Address;
    exists: true;
    curve: Address;
    deployer: Address;
    creatorFeeRecipient: Address;
    graduationThreshold: bigint;
    creatorTaxBpsAtLaunch: number;
    phase: number;
    name: string;
    symbol: string;
    totalSupply: bigint;
    decimals: number;
    quoteReserve: bigint;
    tokenReserve: bigint;
    realQuoteReserve: bigint;
    progress: number;
    readyToGraduate: boolean;
    graduated: boolean;
    feeBps: bigint;
    creatorTaxBps: bigint;
    // Only meaningful once phase > 0 (NotGraduated): a fresh launch has no
    // LP to lock yet, so `false` pre-graduation is expected, not a red
    // flag. Callers should gate on `phase` before treating this as risk.
    lpLocked: boolean;
    lockedTokenSupply: bigint;
    devBuy: DevBuy;
    tokenTemplate: typeof PONS_V2_TOKEN_TEMPLATE;
  };

export async function scanLaunch(
  client: RobinhoodClient,
  token: Address,
): Promise<LaunchScan> {
  const launched = await client.readContract({
    address: PONS_V2_FACTORY_ADDRESS,
    abi: ponsV2FactoryAbi,
    functionName: "getLaunchedToken",
    args: [token],
  });

  if (!launched.exists) {
    return { token, exists: false };
  }

  const { curve, deployer, creatorFeeRecipient, graduationThreshold, phase } =
    launched;
  const curveContract = { address: curve, abi: ponsV2CurveAbi } as const;
  const tokenContract = { address: token, abi: erc20MinimalAbi } as const;

  const [
    reserves,
    realQuoteReserve,
    readyToGraduate,
    graduated,
    feeBps,
    creatorTaxBps,
    name,
    symbol,
    totalSupply,
    decimals,
    lpLocked,
    lockedTokenSupply,
    devBuy,
  ] = await Promise.all([
    client.readContract({ ...curveContract, functionName: "getReserves" }),
    client.readContract({
      ...curveContract,
      functionName: "realQuoteReserve",
    }),
    client.readContract({
      ...curveContract,
      functionName: "readyToGraduate",
    }),
    client.readContract({ ...curveContract, functionName: "graduated" }),
    client.readContract({ ...curveContract, functionName: "feeBps" }),
    client.readContract({
      ...curveContract,
      functionName: "creatorTaxBps",
    }),
    client.readContract({ ...tokenContract, functionName: "name" }),
    client.readContract({ ...tokenContract, functionName: "symbol" }),
    client.readContract({ ...tokenContract, functionName: "totalSupply" }),
    client.readContract({ ...tokenContract, functionName: "decimals" }),
    client.readContract({
      address: PONS_V2_LAUNCH_LOCKER_ADDRESS,
      abi: ponsV2LaunchLockerAbi,
      functionName: "isLocked",
      args: [token],
    }),
    client.readContract({
      address: PONS_V2_LAUNCH_LOCKER_ADDRESS,
      abi: ponsV2LaunchLockerAbi,
      functionName: "lockedTokenSupply",
      args: [token],
    }),
    fetchDevBuys(client, curve, deployer),
  ]);

  const progress = graduationThreshold > 0n
    ? Number((realQuoteReserve * 10000n) / graduationThreshold) / 10000
    : 0;

  return {
    token,
    exists: true,
    curve,
    deployer,
    creatorFeeRecipient,
    graduationThreshold,
    creatorTaxBpsAtLaunch: launched.creatorTaxBps,
    phase,
    name,
    symbol,
    totalSupply,
    decimals,
    quoteReserve: reserves[0],
    tokenReserve: reserves[1],
    realQuoteReserve,
    progress,
    readyToGraduate,
    graduated,
    feeBps,
    creatorTaxBps,
    lpLocked,
    lockedTokenSupply,
    devBuy,
    tokenTemplate: PONS_V2_TOKEN_TEMPLATE,
  };
}

async function fetchDevBuys(
  client: RobinhoodClient,
  curve: Address,
  deployer: Address,
): Promise<DevBuy> {
  const logs = await client.getContractEvents({
    address: curve,
    abi: ponsV2CurveAbi,
    eventName: "CurveBuy",
    fromBlock: 0n,
    toBlock: "latest",
  });

  const deployerLower = deployer.toLowerCase();
  const devLogs = logs.filter((log) =>
    log.args.buyer?.toLowerCase() === deployerLower ||
    log.args.recipient?.toLowerCase() === deployerLower
  );

  return {
    buyCount: devLogs.length,
    totalQuoteIn: devLogs.reduce(
      (sum, log) => sum + (log.args.quoteIn ?? 0n),
      0n,
    ),
  };
}

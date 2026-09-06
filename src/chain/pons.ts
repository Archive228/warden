import type { Address } from "viem";
import type { RobinhoodClient } from "./client.ts";
import { ponsV2CurveAbi } from "./abi/curve.ts";
import { erc20MinimalAbi } from "./abi/erc20.ts";
import { PONS_V2_FACTORY_ADDRESS, ponsV2FactoryAbi } from "./abi/factory.ts";
import {
  PONS_V2_LAUNCH_LOCKER_ADDRESS,
  ponsV2LaunchLockerAbi,
} from "./abi/locker.ts";
import { withRetry } from "../util/retry.ts";
import type { LaunchpadScan } from "./launchpad.ts";

// Exemptions are a specific address allowlist set at launch (deployer +
// creator + up to 32 extra) — this is just some address that was
// certainly never on it, used to read the tax an ordinary new buyer
// would actually pay right now.
const NON_EXEMPT_PROBE_ADDRESS = `0x${"0".repeat(39)}1` as const;

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

// Distinguishing "checked, zero dev buys" from "couldn't check" matters: a
// bare `buyCount: 0` on failure would silently look identical to a real
// clean bill of health.
export type DevBuy =
  | { available: true; buyCount: number; totalQuoteIn: bigint }
  | { available: false; reason: string };

export type LaunchScan =
  | { token: Address; exists: false }
  | {
    token: Address;
    exists: true;
    curve: Address;
    deployer: Address;
    creatorFeeRecipient: Address;
    // The zero address means the curve is quoted in native ETH (buy() takes
    // msg.value). Anything else means it's quoted in that ERC20 instead -
    // this was missed entirely until a live buy-simulation reverted with
    // UnexpectedNativeValue() on a real launch paired with an ERC20, not
    // ETH. src/execute/ only implements the native path; see its own notes.
    pairToken: Address;
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
    // Confirmed to exist in deployed bytecode (live eth_call probe), value
    // for real reasoning unconfirmed (returned 0 on every curve probed so
    // far) — null means the call itself failed on this curve.
    snipeTaxBps: bigint | null;
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
  const launched = await withRetry(() =>
    client.readContract({
      address: PONS_V2_FACTORY_ADDRESS,
      abi: ponsV2FactoryAbi,
      functionName: "getLaunchedToken",
      args: [token],
    })
  );

  if (!launched.exists) {
    return { token, exists: false };
  }

  const {
    curve,
    deployer,
    creatorFeeRecipient,
    pairToken,
    graduationThreshold,
    phase,
  } = launched;
  const curveContract = { address: curve, abi: ponsV2CurveAbi } as const;
  const tokenContract = { address: token, abi: erc20MinimalAbi } as const;

  const [
    reserves,
    realQuoteReserve,
    readyToGraduate,
    graduated,
    feeBps,
    creatorTaxBps,
    snipeTaxBps,
    name,
    symbol,
    totalSupply,
    decimals,
    lpLocked,
    lockedTokenSupply,
    devBuy,
  ] = await withRetry(() =>
    Promise.all([
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
      fetchSnipeTaxBps(client, curve),
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
    ])
  );

  const progress = graduationThreshold > 0n
    ? Number((realQuoteReserve * 10000n) / graduationThreshold) / 10000
    : 0;

  return {
    token,
    exists: true,
    curve,
    deployer,
    creatorFeeRecipient,
    pairToken,
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
    snipeTaxBps,
    lpLocked,
    lockedTokenSupply,
    devBuy,
    tokenTemplate: PONS_V2_TOKEN_TEMPLATE,
  };
}

async function fetchSnipeTaxBps(
  client: RobinhoodClient,
  curve: Address,
): Promise<bigint | null> {
  try {
    return await client.readContract({
      address: curve,
      abi: ponsV2CurveAbi,
      functionName: "currentSnipeTaxBps",
      args: [NON_EXEMPT_PROBE_ADDRESS],
    });
  } catch {
    return null;
  }
}

async function fetchDevBuys(
  client: RobinhoodClient,
  curve: Address,
  deployer: Address,
): Promise<DevBuy> {
  let logs;
  try {
    logs = await client.getContractEvents({
      address: curve,
      abi: ponsV2CurveAbi,
      eventName: "CurveBuy",
      fromBlock: 0n,
      toBlock: "latest",
    });
  } catch (err) {
    return {
      available: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }

  const deployerLower = deployer.toLowerCase();
  const devLogs = logs.filter((log) =>
    log.args.buyer?.toLowerCase() === deployerLower ||
    log.args.recipient?.toLowerCase() === deployerLower
  );

  return {
    available: true,
    buyCount: devLogs.length,
    totalQuoteIn: devLogs.reduce(
      (sum, log) => sum + (log.args.quoteIn ?? 0n),
      0n,
    ),
  };
}

export function toLaunchpadScan(
  scan: Extract<LaunchScan, { exists: true }>,
): Extract<LaunchpadScan, { exists: true }> {
  return {
    launchpad: "pons-v2",
    token: scan.token,
    exists: true,
    name: scan.name,
    symbol: scan.symbol,
    totalSupply: scan.totalSupply,
    decimals: scan.decimals,
    quoteAsset: scan.pairToken,
    progress: scan.progress,
    graduated: scan.graduated,
    feeBps: Number(scan.feeBps),
    lpLocked: scan.lpLocked,
    lpLockMechanism: "vault",
    ownerPrivilege: {
      checked: true,
      active: false,
      expectedRightNow: false,
    },
  };
}

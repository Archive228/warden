import { type Address, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { RobinhoodClient } from "../chain/client.ts";
import { robinhoodChain } from "../chain/robinhoodChain.ts";
import { ponsV2CurveAbi } from "../chain/abi/curve.ts";

export interface BuyPlan {
  curve: Address;
  quoteIn: bigint;
  minTokensOut: bigint;
  recipient: Address;
}

export function createWardenWallet(rpcUrl?: string) {
  const key = Deno.env.get("WALLET_PRIVATE_KEY");
  if (!key) {
    throw new Error(
      "WALLET_PRIVATE_KEY is not set - required for --live. Never commit this to .env in git; it's gitignored, keep it that way.",
    );
  }
  const account = privateKeyToAccount(key as `0x${string}`);
  return createWalletClient({
    account,
    chain: robinhoodChain,
    transport: http(rpcUrl ?? robinhoodChain.rpcUrls.default.http[0]),
  });
}

export type WardenWallet = ReturnType<typeof createWardenWallet>;

// A real eth_call against live state with an arbitrary account - proves
// the transaction WOULD be accepted by the real contract (right
// selector/args, curve not graduated, slippage bound satisfied) without
// spending anything or needing a funded key. This is the verification this
// project can respectably run itself; broadcasting a real transaction with
// real money is not, and hasn't been done here.
export function simulateBuy(
  client: RobinhoodClient,
  plan: BuyPlan,
  account: Address,
) {
  return client.simulateContract({
    address: plan.curve,
    abi: ponsV2CurveAbi,
    functionName: "buy",
    args: [plan.quoteIn, plan.minTokensOut, plan.recipient],
    value: plan.quoteIn,
    account,
  });
}

export function executeBuy(
  wallet: WardenWallet,
  plan: BuyPlan,
): Promise<`0x${string}`> {
  return wallet.writeContract({
    address: plan.curve,
    abi: ponsV2CurveAbi,
    functionName: "buy",
    args: [plan.quoteIn, plan.minTokensOut, plan.recipient],
    value: plan.quoteIn,
    chain: robinhoodChain,
    account: wallet.account,
  });
}

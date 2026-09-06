import type { Address } from "viem";

// The common shape every launchpad adapter normalizes into. Deliberately
// thin: only what genuinely means the same thing across protocols with
// real structural differences (Pons locks LP in a vault, four.meme burns
// it via a DEX pair; Pons's deployer never has privileges, four.meme's
// token owner legitimately IS the manager pre-graduation). Forcing more
// than this into one shape would mean lying about one protocol to fit the
// other's assumptions - see ownerPrivilege below for the concrete case
// that would have gone wrong.
export type LpLockMechanism = "vault" | "burn" | "unavailable";

// "Owner privilege active" means something different per protocol, so the
// interpretation travels with the fact instead of being collapsed into a
// single boolean a consumer would misread. expectedRightNow encodes what
// this protocol's OWN design makes normal at this launch's current phase -
// a naive "owner != 0 is bad" check transplanted from Pons would
// false-positive on every healthy four.meme launch pre-graduation.
export type OwnerPrivilegeSignal =
  | {
    checked: true;
    active: boolean;
    expectedRightNow: boolean;
  }
  | { checked: false; reason: string };

export type LaunchpadScan =
  | { launchpad: string; token: Address; exists: false }
  | {
    launchpad: string;
    token: Address;
    exists: true;
    name: string;
    symbol: string;
    totalSupply: bigint;
    decimals: number;
    quoteAsset: Address; // zero address = native chain currency
    progress: number; // 0-1
    graduated: boolean;
    feeBps: number;
    lpLocked: boolean | null; // null = mechanism reports "unavailable"
    lpLockMechanism: LpLockMechanism;
    ownerPrivilege: OwnerPrivilegeSignal;
  };

import type { LaunchScan } from "../chain/pons.ts";

// Deliberately NOT a "did this rug" classifier - that needs a much
// stronger evidentiary bar than this project can defend (price history,
// holder-exit patterns, off-chain context) and Pons's own design already
// structurally blocks the classic rug vectors this project could check
// for (LP is vault-locked not pullable, deployer has zero mint/blacklist
// privilege - see PONS_V2_TOKEN_TEMPLATE). What IS objectively checkable
// from on-chain state alone: did it graduate, or did it stall. Anything
// stronger would be asserting a moral judgment this project can't source.
export type ActualOutcome =
  | { label: "graduated"; evidence: string }
  | { label: "abandoned"; evidence: string }
  | { label: "active"; evidence: string }
  | { label: "indeterminate"; evidence: string };

const ABANDONED_MIN_DAYS = 7;
const ABANDONED_MAX_PROGRESS = 0.05;

export function classifyOutcome(
  scan: Extract<LaunchScan, { exists: true }>,
  daysSinceLaunch: number,
): ActualOutcome {
  if (scan.graduated) {
    return {
      label: "graduated",
      evidence: `phase=${scan.phase}, graduated=true after ${
        daysSinceLaunch.toFixed(1)
      } days`,
    };
  }

  if (daysSinceLaunch < ABANDONED_MIN_DAYS) {
    return {
      label: "indeterminate",
      evidence: `only ${
        daysSinceLaunch.toFixed(1)
      } days old, too early to call`,
    };
  }

  if (scan.progress < ABANDONED_MAX_PROGRESS) {
    return {
      label: "abandoned",
      evidence: `${daysSinceLaunch.toFixed(1)} days since launch, progress=${
        (scan.progress * 100).toFixed(1)
      }%, never graduated`,
    };
  }

  return {
    label: "active",
    evidence: `${daysSinceLaunch.toFixed(1)} days since launch, progress=${
      (scan.progress * 100).toFixed(1)
    }%, not graduated but not stalled either`,
  };
}

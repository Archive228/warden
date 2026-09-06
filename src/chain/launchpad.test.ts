import { assertEquals } from "@std/assert";
import { createRobinhoodClient } from "./client.ts";
import { scanLaunch, toLaunchpadScan as ponsToLaunchpadScan } from "./pons.ts";
import { createBscClient } from "./bscClient.ts";
import {
  scanFourMemeLaunch,
  toLaunchpadScan as fourMemeToLaunchpadScan,
} from "./fourmeme.ts";

// The actual claim feature_list.json makes for "multi-launchpad support":
// two structurally different protocols (Pons locks LP in a vault and never
// gives its deployer privileges; four.meme burns LP via a DEX pair and
// legitimately hands its token's Ownable role to the manager
// pre-graduation) normalize to the exact same field set. Runs both
// adapters against real, independently-found live launches - not fixtures
// - and diffs the shapes directly, rather than trusting each module's own
// test file to have separately gotten it right.
Deno.test("Pons and four.meme normalize to an identical LaunchpadScan shape on real live launches", async () => {
  const ponsClient = createRobinhoodClient();
  const ponsScan = await scanLaunch(
    ponsClient,
    "0xc65AF5ed7d40A2A0C8E362B93b4AF70A40a58456",
  );
  assertEquals(ponsScan.exists, true);
  if (!ponsScan.exists) return;

  const bscClient = createBscClient();
  const fourMemeScan = await scanFourMemeLaunch(
    bscClient,
    "0x0a75210672cd91d22562695631c0bd131942ffff",
  );
  assertEquals(fourMemeScan.exists, true);
  if (!fourMemeScan.exists) return;

  const ponsNormalized = ponsToLaunchpadScan(ponsScan);
  const fourMemeNormalized = fourMemeToLaunchpadScan(fourMemeScan);

  assertEquals(
    Object.keys(ponsNormalized).sort(),
    Object.keys(fourMemeNormalized).sort(),
  );
  assertEquals(
    Object.keys(ponsNormalized.ownerPrivilege).sort(),
    Object.keys(fourMemeNormalized.ownerPrivilege).sort(),
  );

  // The two protocols' launchpad-specific truth genuinely differs here -
  // this is the point, not a bug: Pons's deployer never has privileges
  // (active:false is always correct), four.meme's manager legitimately
  // holds them pre-graduation (active:true is expected, not a red flag).
  assertEquals(ponsNormalized.ownerPrivilege.checked, true);
  assertEquals(fourMemeNormalized.ownerPrivilege.checked, true);
  if (
    !ponsNormalized.ownerPrivilege.checked ||
    !fourMemeNormalized.ownerPrivilege.checked
  ) return;
  assertEquals(ponsNormalized.ownerPrivilege.active, false);
  assertEquals(fourMemeNormalized.ownerPrivilege.active, true);
  assertEquals(fourMemeNormalized.ownerPrivilege.expectedRightNow, true);
});

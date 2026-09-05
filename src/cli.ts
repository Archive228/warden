#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write
import { Command } from "commander";
import { isAddress } from "viem";
import { createRobinhoodClient } from "./chain/client.ts";
import { fetchHolderConcentration } from "./chain/holders.ts";
import { scanLaunch } from "./chain/pons.ts";
import { vetRepo } from "./repo/fingerprint.ts";

const program = new Command();

program
  .name("warden")
  .description("Agentic vetting for new token launches")
  .version("0.1.0");

program
  .command("scan <token>")
  .description(
    "Read a Pons v2 launch on-chain: curve state, LP lock, holder concentration",
  )
  .action(async (token: string) => {
    if (!isAddress(token)) {
      console.error(`not a valid address: ${token}`);
      Deno.exit(1);
    }

    try {
      const client = createRobinhoodClient(Deno.env.get("RPC_URL"));
      const scan = await scanLaunch(client, token);

      if (!scan.exists) {
        console.log(
          JSON.stringify(
            {
              token,
              exists: false,
              note: "not a Pons v2 launch on this factory",
            },
            null,
            2,
          ),
        );
        return;
      }

      const holders = await fetchHolderConcentration(token, scan.totalSupply);

      console.log(
        JSON.stringify(
          { ...scan, holders },
          (_key, value) => typeof value === "bigint" ? value.toString() : value,
          2,
        ),
      );
    } catch (err) {
      console.error(
        `scan failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      Deno.exit(1);
    }
  });

program
  .command("vet-repo <owner/repo>")
  .description(
    "Fingerprint a GitHub repo for authenticity red flags: dormant-account reactivation, fork bursts, self-promoted tokens",
  )
  .action(async (ownerRepo: string) => {
    const [owner, repo] = ownerRepo.split("/");
    if (!owner || !repo || ownerRepo.split("/").length !== 2) {
      console.error(`expected owner/repo, got: ${ownerRepo}`);
      Deno.exit(1);
    }

    try {
      const fingerprint = await vetRepo(owner, repo);
      console.log(JSON.stringify(fingerprint, null, 2));
    } catch (err) {
      console.error(
        `vet-repo failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      Deno.exit(1);
    }
  });

program.parse(Deno.args, { from: "user" });

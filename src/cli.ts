#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write
import { Command } from "commander";
import { isAddress } from "viem";
import { createRobinhoodClient } from "./chain/client.ts";
import { fetchHolderConcentration } from "./chain/holders.ts";
import { scanLaunch } from "./chain/pons.ts";
import { vetRepo } from "./repo/fingerprint.ts";
import { judgeLaunch, saveVerdictLog } from "./judge/judge.ts";

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

program
  .command("judge <token>")
  .description(
    "Combine an on-chain scan and (optionally) a repo fingerprint into a plain-language verdict",
  )
  .option("--repo <owner/repo>", "GitHub repo linked to this launch, if any")
  .action(async (token: string, opts: { repo?: string }) => {
    if (!isAddress(token)) {
      console.error(`not a valid address: ${token}`);
      Deno.exit(1);
    }

    try {
      const client = createRobinhoodClient(Deno.env.get("RPC_URL"));
      const scan = await scanLaunch(client, token);

      if (!scan.exists) {
        console.error(`${token} is not a Pons v2 launch on this factory`);
        Deno.exit(1);
      }

      let fingerprint = null;
      if (opts.repo) {
        const [owner, repo] = opts.repo.split("/");
        if (!owner || !repo || opts.repo.split("/").length !== 2) {
          console.error(`--repo expected owner/repo, got: ${opts.repo}`);
          Deno.exit(1);
        }
        fingerprint = await vetRepo(owner, repo);
      }

      const verdict = await judgeLaunch(scan, fingerprint);
      const logPath = await saveVerdictLog(token, verdict);

      console.log(JSON.stringify(verdict, null, 2));
      console.error(`reasoning log saved: ${logPath}`);
    } catch (err) {
      console.error(
        `judge failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      Deno.exit(1);
    }
  });

program.parse(Deno.args, { from: "user" });

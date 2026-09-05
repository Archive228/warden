#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write
import { Command } from "commander";
import { isAddress } from "viem";
import { createRobinhoodClient } from "./chain/client.ts";
import { fetchHolderConcentration } from "./chain/holders.ts";
import { scanLaunch } from "./chain/pons.ts";
import { vetRepo } from "./repo/fingerprint.ts";
import { judgeLaunch, saveVerdictLog } from "./judge/judge.ts";
import { formatVerdictMessage } from "./alerts/format.ts";
import { sendTelegramAlert } from "./alerts/telegram.ts";
import { watchLaunches } from "./watch/watch.ts";
import type { Address } from "viem";

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

async function processLaunch(
  client: ReturnType<typeof createRobinhoodClient>,
  token: Address,
): Promise<void> {
  const scan = await scanLaunch(client, token);
  if (!scan.exists) return;

  const verdict = await judgeLaunch(scan, null);
  const logPath = await saveVerdictLog(token, verdict);
  console.log(
    `[${
      new Date().toISOString()
    }] ${token} -> ${verdict.category} (log: ${logPath})`,
  );

  await sendTelegramAlert(formatVerdictMessage(token, verdict));
}

program
  .command("watch")
  .description(
    "Poll for new Pons v2 launches, judge each one, and alert to Telegram. Alert-only - never submits a transaction.",
  )
  .option(
    "--once <token>",
    "process a single already-known token immediately instead of polling for new launches - for testing the pipeline without waiting",
  )
  .option("--poll-interval-ms <ms>", "polling interval", "30000")
  .action(async (opts: { once?: string; pollIntervalMs: string }) => {
    const client = createRobinhoodClient(Deno.env.get("RPC_URL"));

    // opts.once !== undefined, NOT `if (opts.once)`: a falsy-but-provided
    // value (like an empty string from a bad shell substitution - this
    // exact bug shipped once, caught live when a curl failure fed
    // `--once ""` through and it silently fell into the infinite poll
    // loop instead of erroring) must still hit validation below, not
    // silently take the "no value given" branch.
    if (opts.once !== undefined) {
      if (!isAddress(opts.once)) {
        console.error(`not a valid address: ${opts.once}`);
        Deno.exit(1);
      }
      try {
        await processLaunch(client, opts.once);
      } catch (err) {
        console.error(
          `watch --once failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        Deno.exit(1);
      }
      return;
    }

    console.log(
      "watching for new Pons v2 launches (alert-only, ctrl-c to stop)...",
    );
    await watchLaunches(client, (token) => processLaunch(client, token), {
      pollIntervalMs: Number(opts.pollIntervalMs),
      onError: (err) =>
        console.error(
          `watch error (continuing): ${
            err instanceof Error ? err.message : String(err)
          }`,
        ),
    });
  });

program.parse(Deno.args, { from: "user" });

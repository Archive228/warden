#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write
import { Command } from "commander";
import { isAddress } from "viem";
import { createRobinhoodClient } from "./chain/client.ts";
import { createBscClient } from "./chain/bscClient.ts";
import { fetchHolderConcentration } from "./chain/holders.ts";
import {
  scanLaunch,
  toLaunchpadScan as ponsToLaunchpadScan,
} from "./chain/pons.ts";
import {
  scanFourMemeLaunch,
  toLaunchpadScan as fourMemeToLaunchpadScan,
} from "./chain/fourmeme.ts";
import { vetRepo } from "./repo/fingerprint.ts";
import { judgeLaunch, saveVerdictLog } from "./judge/judge.ts";
import { formatVerdictMessage } from "./alerts/format.ts";
import { sendTelegramAlert } from "./alerts/telegram.ts";
import { watchLaunches } from "./watch/watch.ts";
import { decideTrade, type TradeOptions } from "./execute/decide.ts";
import { logTradeDecision } from "./execute/tradelog.ts";
import { runBacktest, summarizeBacktest } from "./backtest/backtest.ts";
import type { Address } from "viem";

const program = new Command();

program
  .name("warden")
  .description("Agentic vetting for new token launches")
  .version("0.1.0");

program
  .command("scan <token>")
  .description(
    "Read a launch on-chain: curve state, LP lock, holder concentration. --launchpad selects which protocol/chain (default pons-v2).",
  )
  .option(
    "--launchpad <name>",
    "pons-v2 (Robinhood Chain) or four-meme (BNB Smart Chain)",
    "pons-v2",
  )
  .option(
    "--normalized",
    "also print the cross-launchpad normalized view (same shape regardless of --launchpad)",
    false,
  )
  .action(
    async (token: string, opts: { launchpad: string; normalized: boolean }) => {
      if (!isAddress(token)) {
        console.error(`not a valid address: ${token}`);
        Deno.exit(1);
      }

      try {
        if (opts.launchpad === "four-meme") {
          const client = createBscClient(Deno.env.get("FOURMEME_RPC_URL"));
          const scan = await scanFourMemeLaunch(client, token);

          if (!scan.exists) {
            console.log(
              JSON.stringify(
                { token, exists: false, note: "not a four.meme launch" },
                null,
                2,
              ),
            );
            return;
          }

          const output = opts.normalized ? fourMemeToLaunchpadScan(scan) : scan;
          console.log(
            JSON.stringify(
              output,
              (_key, value) =>
                typeof value === "bigint" ? value.toString() : value,
              2,
            ),
          );
          return;
        }

        if (opts.launchpad !== "pons-v2") {
          console.error(
            `unknown --launchpad: ${opts.launchpad} (expected pons-v2 or four-meme)`,
          );
          Deno.exit(1);
        }

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
        const output = opts.normalized
          ? ponsToLaunchpadScan(scan)
          : { ...scan, holders };

        console.log(
          JSON.stringify(
            output,
            (_key, value) =>
              typeof value === "bigint" ? value.toString() : value,
            2,
          ),
        );
      } catch (err) {
        console.error(
          `scan failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        Deno.exit(1);
      }
    },
  );

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
  tradeOpts: TradeOptions,
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

  const decision = await decideTrade(scan, verdict, tradeOpts);
  await logTradeDecision(decision);
  console.log(
    `[trade] ${token}: attempted=${decision.attempted} - ${decision.reason}`,
  );
}

program
  .command("watch")
  .description(
    "Poll for new Pons v2 launches, judge each one, and alert to Telegram. Dry-run by default - only submits a transaction with --live, above --min-confidence, and only on native-ETH-paired launches.",
  )
  .option(
    "--once <token>",
    "process a single already-known token immediately instead of polling for new launches - for testing the pipeline without waiting",
  )
  .option("--poll-interval-ms <ms>", "polling interval", "30000")
  .option(
    "--live",
    "actually submit a buy transaction when a verdict clears the threshold (requires WALLET_PRIVATE_KEY). Without this flag, every launch is alert-only, unconditionally, regardless of verdict.",
    false,
  )
  .option(
    "--min-confidence <n>",
    "minimum verdict confidence (0-1) to buy, on a low_risk verdict only",
    "0.8",
  )
  .option("--buy-amount-eth <n>", "ETH to spend per buy", "0.01")
  .option("--slippage-bps <n>", "slippage tolerance in basis points", "300")
  .action(
    async (
      opts: {
        once?: string;
        pollIntervalMs: string;
        live: boolean;
        minConfidence: string;
        buyAmountEth: string;
        slippageBps: string;
      },
    ) => {
      const client = createRobinhoodClient(Deno.env.get("RPC_URL"));
      const tradeOpts: TradeOptions = {
        live: opts.live,
        minConfidence: Number(opts.minConfidence),
        buyAmountEth: opts.buyAmountEth,
        slippageBps: Number(opts.slippageBps),
      };

      if (opts.live) {
        console.log(
          `--live is ON: will attempt real buys (${opts.buyAmountEth} ETH each) on low_risk verdicts >= ${opts.minConfidence} confidence, native-ETH-paired launches only.`,
        );
      }

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
          await processLaunch(client, opts.once, tradeOpts);
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
        `watching for new Pons v2 launches (${
          opts.live ? "LIVE" : "alert-only"
        }, ctrl-c to stop)...`,
      );
      await watchLaunches(
        client,
        (token) => processLaunch(client, token, tradeOpts),
        {
          pollIntervalMs: Number(opts.pollIntervalMs),
          onError: (err) =>
            console.error(
              `watch error (continuing): ${
                err instanceof Error ? err.message : String(err)
              }`,
            ),
        },
      );
    },
  );

program
  .command("backtest")
  .description(
    "Replay historical Pons v2 launches through scan+judge and report how judge's verdicts lined up against what actually happened - graduated vs. stalled, not a fabricated 'rugged' label.",
  )
  .requiredOption(
    "--since <date>",
    "ISO date or anything Date() parses, e.g. 2026-09-01",
  )
  .action(async (opts: { since: string }) => {
    const since = new Date(opts.since);
    if (Number.isNaN(since.getTime())) {
      console.error(`not a valid date: ${opts.since}`);
      Deno.exit(1);
    }

    try {
      const client = createRobinhoodClient(Deno.env.get("RPC_URL"));
      console.error(`searching for launches since ${since.toISOString()}...`);
      const entries = await runBacktest(client, since);
      const summary = summarizeBacktest(entries);

      console.log(JSON.stringify({ summary, entries }, null, 2));

      if (summary.verdictsUnavailable > 0) {
        console.error(
          `${summary.verdictsUnavailable}/${summary.totalHistoricalLaunches} launches have no verdict (judge failed - see each entry's verdictError). Win-rate figures above only cover the ${summary.verdictsAvailable} that succeeded.`,
        );
      }
    } catch (err) {
      console.error(
        `backtest failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      Deno.exit(1);
    }
  });

program.parse(Deno.args, { from: "user" });

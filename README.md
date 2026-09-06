# warden

Agentic vetting for new token launches. Reads on-chain risk signals for a
launch (LP lock, mint/blacklist functions, ownership renounce, holder
concentration) and — if the launch links a GitHub repo — fingerprints that
repo for authenticity red flags (account-age-vs-activity mismatch, fork/star
bursts, a self-promoted ticker sitting in the README or the author's bio). An
agent reasons over both and writes a plain-language verdict, not just a score.

**Status: 4 of 7 features working end-to-end**, the first one independently
audited (a fresh review re-verified every claim from scratch rather than
trusting this repo's own docs — see `claude-progress.txt` for what it found,
including one correction to a claim this README used to make). Three more
(`judge`, `watch`, `backtest`) are fully implemented and wired through the
real pipeline but not fully verified end-to-end, all blocked on the same
credential this environment doesn't have (`ANTHROPIC_API_KEY`). See
`feature_list.json` for exactly what's confirmed vs. still open on each.

`warden` reads more than one launchpad now: Pons v2 on Robinhood Chain and
[four.meme](https://four.meme) on BNB Smart Chain, picked specifically because
its LP-lock mechanism (burns liquidity via a DEX pair, no vault contract) and
owner-privilege model (the manager legitimately holds `Ownable` control
*while a token is still on the curve* — expected, not a red flag) are
genuinely different from Pons, not just the same shape on a different chain.
Both normalize to an identical output shape via `--normalized`, verified by
an automated test that runs both against real live launches and diffs the
field names directly.

`warden scan <token>` reads a real Pons v2 launch live — curve progress,
LP-lock, holder concentration, dev-buy history, mint/blacklist facts,
snipe-tax bps. `warden vet-repo <owner>/<repo>` fingerprints a GitHub repo for
the exact red-flag pattern that inspired this project (see "Why") — verified
against that real repo as ground truth, not just synthetic examples.
`warden judge <token>` calls Claude to turn a scan (+ optional repo
fingerprint) into a plain-language verdict — implementation and pipeline
wiring verified live, the actual model call is not (no `ANTHROPIC_API_KEY`
here). `warden watch` polls for new launches and alerts each verdict to
Telegram — the polling loop is verified against real chain state (and caught
two real bugs live in the process, see `claude-progress.txt`), but no message
has ever actually reached Telegram (no bot credentials here either).
`watch --live` gates a real `buy()` behind verdict + confidence + native-ETH-
pairing checks (7 passing unit tests on the gate itself) and its slippage
math is bit-for-bit verified against a real curve's own on-chain simulation —
but has deliberately never broadcast a real transaction. This project does
not fund a wallet or spend real money to verify its own features, on
principle, regardless of how solid the surrounding logic tests out.
`warden backtest --since <date>` replays real historical launches (found by
walking `TokenLaunched` events backward, not synthetic data) through
scan+judge and cross-tabulates judge's verdict against what actually
happened — graduated, stalled/abandoned, or still active, each with its own
on-chain evidence. It does not claim to detect "rugs" (see Known gaps); the
discovery and outcome-classification logic are both tested and verified, the
judge calls inside it fail the same way judge does standalone.

## Why

Researching a launch-sniper repo turned up a project whose own GitHub activity
told a different story than its README: a dormant account suddenly active,
six forks created in the same 19-minute window right after a commit added a
token ticker to the README, a self-promoted contract address sitting in the
author's bio. warden is the check that would have caught it — the same
on-chain vigilance a sniper bot already needs, pointed at the *project*
publicizing a launch as well as the *token* itself.

## Architecture

```
new launch
    |
    v
on-chain multicall  --------->  repo/social fingerprint (if linked)
(LP lock, mint/blacklist,       (account age vs activity, fork/star
 ownership, holder conc.)        timing, self-promoted ticker)
    |                                |
    +----------------+---------------+
                     v
            agent verdict + reasoning log
                     |
                     v
              Telegram alert
                     |
                     v
   verdict==low_risk && confidence>=threshold
       && native-ETH-paired (not ERC20)
                     |
                     v
       (--live only) buy(), slippage-bounded
```

## Run

Requires [Deno](https://deno.com) 2.x — no Node/npm needed.

```sh
./init.sh
deno task start scan <token-address>                        # Pons v2 / Robinhood Chain (default)
deno task start scan <token-address> --launchpad four-meme   # four.meme / BNB Smart Chain
deno task start scan <token-address> --normalized            # cross-launchpad shape, either one
deno task start vet-repo <owner>/<repo>
deno task start judge <token-address> [--repo <owner>/<repo>]
deno task start watch --once <token-address>   # test feed, one launch, no waiting
deno task start watch                          # live feed, polls forever, ctrl-c to stop
deno task start watch --live --min-confidence 0.9 --buy-amount-eth 0.01 --slippage-bps 300
deno task start backtest --since 2026-09-01
deno task test
```

`judge`/`watch` are Pons-only for now — the agent-verdict and alert/execution
pipeline hasn't been extended to four.meme yet, only the read side has.

`judge` needs `ANTHROPIC_API_KEY`, `watch` additionally needs
`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`, and `watch --live` additionally
needs `WALLET_PRIVATE_KEY` in `.env` — without them, all fail with a clear,
specific error rather than a crash. Without `--live`, `watch` never reads
`WALLET_PRIVATE_KEY` at all. Every trade decision (attempted or not) is
appended to `verdicts/trades.jsonl`, one JSON object per line.

`vet-repo` works unauthenticated but at GitHub's much lower rate limit (and
some endpoints 403 outright without one, reproduced live against
`ponsdotdev`) — set `GITHUB_TOKEN` in `.env` for real use.

## Built on

Protocol reference: official [Pons v2 docs](https://docs.ponsfamily.com/v2)
and [ponsdotdev/ponsfamily](https://github.com/ponsdotdev/ponsfamily) (the
official Pons contracts repo, MIT-licensed via SPDX headers in the source —
warden doesn't vendor any of it, it only calls the already-deployed
contracts through their own ABI). On-chain reads via [viem](https://viem.sh).
Chain data cross-checked against [Blockscout](https://robinhoodchain.blockscout.com).
Agent reasoning (not built yet) will use the Claude API.

## Known gaps

- **Snipe-tax cause is unconfirmed.** `currentSnipeTaxBps()` *is* implemented
  and called — an earlier version of this README said the function didn't
  exist in the deployed contract, based on it being absent from
  `ponsdotdev/ponsfamily`'s current public source. An independent audit
  didn't stop at the source repo: it ran raw `eth_call` probes with real
  selectors against 3 live curves (with a negative control confirming the
  contract genuinely reverts on an unknown selector, not silently), and
  found the function resolves cleanly on all 3 — it's in the deployed
  bytecode even though it's missing from the public repo's current HEAD.
  It returns `0` on every curve checked so far; every launch checked was at
  least a couple of minutes old, past the ~15-second decay window described
  in the docs, so `0` is consistent with "already decayed," not necessarily
  proof the read is meaningless — this hasn't been confirmed on a launch
  checked within seconds of creation.
- **Holder concentration** now divides by the token's real `totalSupply`
  (an earlier version divided by the sum of one fetched page instead, which
  measurably overstated concentration — an audit caught a ~3 percentage
  point error on a real token). `sampledHolders` / `hasMoreHolders` still
  tell you whether Blockscout's holder list was fully fetched.
- **Star-burst timing isn't checked, on purpose.** GitHub restricted
  stargazer-listing to admins/collaborators around July 2026: REST 404s for
  a third-party repo, and GraphQL silently returns an empty list rather than
  an error even when the repo has real stars. `vet-repo` reports
  `starTimingAvailable: false` explicitly rather than ever treating an empty
  result as "no burst found." Fork timing (unaffected) carries this signal
  instead.
- **"First activity" is a proxy, not a direct measurement.** `vet-repo` uses
  the account's oldest *currently visible* repo as a stand-in for when it
  first became active — cheap to compute, but wrong if the account's real
  first activity was on a repo since deleted or made private.
- **Whitelist-gated protocol.** Pons v2 launch creation is currently
  whitelist-only and the protocol is explicitly unaudited per its own docs.
  Real launches are happening despite the gating (this is not a theoretical
  tool — every number above came from a live launch found on-chain the same
  day this was written), but that status is worth surfacing to a user
  eventually rather than staying buried in this README.
- **The public RPC rate-limits under sustained `watch` polling** — reproduced
  live, not theoretical: a test run of `watch` hit "Too Many Requests" from
  `rpc.mainnet.chain.robinhood.com` after enough consecutive poll cycles, even
  with retry/backoff already in place. It degrades the way it's supposed to
  (`watch` logs the error and keeps running instead of crashing), but a
  free public RPC has a real ceiling. For anything beyond light testing, point
  `RPC_URL` at a paid provider (Alchemy/QuickNode — the protocol's own docs
  recommend this for production use, not just this project).
- **Only native-ETH-paired launches can be bought.** `getLaunchedToken`
  returns a `pairToken` field this project didn't even expose until building
  the buy path — some launches are quoted in an ERC20 instead of ETH (~30%
  in one live sample, found by accident when a buy-simulation reverted with
  `UnexpectedNativeValue()` on one). `watch --live` explicitly refuses these
  rather than attempting a transaction that would revert or, worse, be
  silently wrong.
- **Real execution has never been tested with real money, deliberately.**
  Everything short of an actual broadcast is verified: the exact `buy()`
  signature (from real source), slippage math matched bit-for-bit against a
  real curve's own `simulateContract` result, and 7 unit tests on the
  verdict/confidence/pairing/`--live` gate. Funding a wallet and confirming
  a real transaction lands is a decision for whoever runs this with their
  own funds, not something this project does on its own to tick a box.

- **The public RPC's `eth_getLogs` had a real outage while this project was
  testing** (not rate-limiting this time — a different failure mode).
  `eth_blockNumber` kept working; `eth_getLogs` on the Pons factory
  consistently returned `"internal server errror"` (their typo), then later
  leaked an internal backend address in a timeout error
  (`10.31.45.18:8547`) — clear evidence of a real, currently-ongoing
  infrastructure problem on Robinhood Chain's RPC provider side, not
  anything in this codebase. Two tests that depend on `eth_getLogs`
  (`src/execute/buy.test.ts`, `src/watch/watch.test.ts`) may fail for this
  reason and not because of a real regression — check whether the same raw
  JSON-RPC call fails outside this project before assuming the code broke.
- **four.meme, on top of the gaps already known for Pons:** only the
  native-BNB-paired case's PancakeSwap-pair lookup was exercised against a
  *self-discovered* graduated launch — BSC's overall PancakeSwap volume is
  too high for a public RPC's `eth_getLogs` window to search for one
  directly (hit `-32005 limit exceeded` trying), so the burn-percentage
  arithmetic was instead spot-checked against a specific graduated pair a
  research pass had already identified, not one this project found on its
  own. There is no four.meme equivalent of Pons's `PONS_V2_TOKEN_TEMPLATE`
  (a mint/blacklist-function existence check) — not implemented at all in
  this pass, and it couldn't be a single fixed constant the way Pons's is
  even if it were: four.meme tokens are individually-deployed proxy clones
  with at least two implementation versions seen in concurrent live use, so
  it would need a per-token selector probe, not a cached fact. `judge`/
  `watch`/execution have not been extended to four.meme at all yet — only
  `scan`.
- **`backtest` does not detect "rugs"**, despite the original feature spec's
  wording. Doing that credibly needs price history and holder-exit patterns
  this project has no verified source for, and Pons's own design already
  structurally blocks the classic rug vectors (LP is vault-locked, not
  pullable; the deployer has zero mint/blacklist privilege) that a rug
  check would otherwise look for. It reports the honest, objectively
  on-chain-checkable alternative instead: graduated vs. abandoned
  (stalled) vs. active vs. too-recent-to-call, each backed by a real
  evidence string, cross-tabulated against judge's verdict category.
- **This whole project's own testing eventually rate-limited the public
  Robinhood Chain RPC it depends on** — a real, observed ceiling, not a
  hypothetical one. A day of manual verification scripts plus repeated
  full-suite test runs against `rpc.mainnet.chain.robinhood.com`
  eventually triggered the same 429 already documented above, on top of a
  separate, real `eth_getLogs` infrastructure outage on their side (also
  documented above) earlier in the same session. Every affected piece of
  functionality had already been confirmed working via direct scripts
  earlier in the session, before the cumulative load set in — treat a
  failing live-network test here as a sign to check the RPC's current
  health first, not as an automatic regression.

## License

MIT

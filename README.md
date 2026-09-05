# warden

Agentic vetting for new token launches. Reads on-chain risk signals for a
launch (LP lock, mint/blacklist functions, ownership renounce, holder
concentration) and — if the launch links a GitHub repo — fingerprints that
repo for authenticity red flags (account-age-vs-activity mismatch, fork/star
bursts, a self-promoted ticker sitting in the README or the author's bio). An
agent reasons over both and writes a plain-language verdict, not just a score.

**Status: 2 of 7 features working end-to-end**, the first one independently
audited (a fresh review re-verified every claim from scratch rather than
trusting this repo's own docs — see `claude-progress.txt` for what it found,
including one correction to a claim this README used to make). Two more
(`judge`, `watch`) are fully implemented and wired through the real pipeline
but not yet verified end-to-end, both blocked on the same shape of gap: a
credential this environment doesn't have. See `feature_list.json` for exactly
what's confirmed vs. still open on each.

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
deno task start scan <token-address>
deno task start vet-repo <owner>/<repo>
deno task start judge <token-address> [--repo <owner>/<repo>]
deno task start watch --once <token-address>   # test feed, one launch, no waiting
deno task start watch                          # live feed, polls forever, ctrl-c to stop
deno task start watch --live --min-confidence 0.9 --buy-amount-eth 0.01 --slippage-bps 300
deno task test
```

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

## License

MIT

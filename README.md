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
including one correction to a claim this README used to make).
`warden scan <token>` reads a real Pons v2 launch live — curve progress,
LP-lock, holder concentration, dev-buy history, mint/blacklist facts,
snipe-tax bps. `warden vet-repo <owner>/<repo>` fingerprints a GitHub repo for
the exact red-flag pattern that inspired this project (see "Why") — verified
against that real repo as ground truth, not just synthetic examples (see
`claude-progress.txt`). The agent verdict, alerts, and execution are still
unbuilt — see [`feature_list.json`](feature_list.json) for the full list.

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
       (--live only, above --min-confidence)
              optional trade
```

## Run

Requires [Deno](https://deno.com) 2.x — no Node/npm needed.

```sh
./init.sh
deno task start scan <token-address>
deno task start vet-repo <owner>/<repo>
deno task test
```

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

## License

MIT

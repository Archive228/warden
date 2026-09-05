# warden

Agentic vetting for new token launches. Reads on-chain risk signals for a
launch (LP lock, mint/blacklist functions, ownership renounce, holder
concentration) and — if the launch links a GitHub repo — fingerprints that
repo for authenticity red flags (account-age-vs-activity mismatch, fork/star
bursts, a self-promoted ticker sitting in the README or the author's bio). An
agent reasons over both and writes a plain-language verdict, not just a score.

**Status: 1 of 7 features working end-to-end.** `warden scan <token>` reads a real
Pons v2 launch live — curve progress, LP-lock, holder concentration, dev-buy
history, mint/blacklist facts. Everything past that (repo fingerprinting, the
agent verdict, alerts, execution) is still unbuilt. See
[`feature_list.json`](feature_list.json) for the full list and
[`claude-progress.txt`](claude-progress.txt) for session-by-session notes,
including two protocol-level gotchas (a snipe-tax function the docs and the
factory reference but the public curve source doesn't implement, and a July
2026 GitHub API change that breaks star-timing checks) worth reading before
touching either area.

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
deno task test
```

## Built on

Protocol reference: official [Pons v2 docs](https://docs.ponsfamily.com/v2)
and [ponsdotdev/ponsfamily](https://github.com/ponsdotdev/ponsfamily) (the
official Pons contracts repo, MIT-licensed via SPDX headers in the source —
warden doesn't vendor any of it, it only calls the already-deployed
contracts through their own ABI). On-chain reads via [viem](https://viem.sh).
Chain data cross-checked against [Blockscout](https://robinhoodchain.blockscout.com).
Agent reasoning (not built yet) will use the Claude API.

## Known gaps

- **Snipe-tax reads aren't implemented.** The docs and `PonsV2LaunchFactory.sol`
  both reference a decaying anti-snipe tax read via `currentSnipeTaxBps()` on
  the curve, but a full read of `PonsV2BondingCurve.sol` (777 lines) found no
  such function anywhere in the public source. Calling it would fail against
  the real contract, so `scan` doesn't try. See `claude-progress.txt` before
  building anything that depends on snipe-tax timing.
- **Holder concentration is a single page, not the full holder list.**
  `topHolderShare` reflects Blockscout's first page of holders, not a
  verified figure across every holder.
- **Whitelist-gated protocol.** Pons v2 launch creation is currently
  whitelist-only and the protocol is explicitly unaudited per its own docs.
  Real launches are happening despite the gating (this is not a theoretical
  tool — every number above came from a live launch found on-chain the same
  day this was written), but that status is worth surfacing to a user
  eventually rather than staying buried in this README.

## License

MIT

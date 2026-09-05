# warden

Agentic vetting for new token launches. Reads on-chain risk signals for a
launch (LP lock, mint/blacklist functions, ownership renounce, holder
concentration) and — if the launch links a GitHub repo — fingerprints that
repo for authenticity red flags (account-age-vs-activity mismatch, fork/star
bursts, a self-promoted ticker sitting in the README or the author's bio). An
agent reasons over both and writes a plain-language verdict, not just a score.

**Status: early scaffold.** Nothing runs yet. See [`feature_list.json`](feature_list.json)
for what's built vs. planned, and [`claude-progress.txt`](claude-progress.txt)
for the current session's notes.

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
deno task start
```

## Built on

Protocol reference: official [Pons v2 docs](https://docs.ponsfamily.com/v2)
and [ponsdotdev/ponsfamily](https://github.com/ponsdotdev/ponsfamily) (the
official Pons contracts repo). On-chain reads via [viem](https://viem.sh).
Agent reasoning via the Claude API. *(Filled in with exact contract
addresses/ABI references as each piece lands — see feature_list.json.)*

## License

MIT

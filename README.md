<p align="center">
  <img src="assets/logo.png" alt="Warden" width="148" />
</p>

<h1 align="center">Warden</h1>

<p align="center">
  <strong>Agentic vetting for new token launches.</strong><br />
  On-chain risk, GitHub authenticity, a written verdict — not a score.
</p>

<p align="center">
  <a href="#license"><img src="https://img.shields.io/badge/license-MIT-e3b341?style=for-the-badge" alt="MIT license" /></a>
  <a href="https://deno.com"><img src="https://img.shields.io/badge/runtime-Deno_2-70ffaf?style=for-the-badge&logo=deno&logoColor=black" alt="Deno 2" /></a>
  <a href="#status"><img src="https://img.shields.io/badge/status-4%2F7_verified-3d8bfd?style=for-the-badge" alt="4 of 7 features verified" /></a>
  <a href="#known-gaps"><img src="https://img.shields.io/badge/live_buys-never-6e7681?style=for-the-badge" alt="Live buys never broadcast" /></a>
</p>

<p align="center">
  <a href="#why">Why</a> ·
  <a href="#what-it-does">What it does</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#launchpads">Launchpads</a> ·
  <a href="#run">Run</a> ·
  <a href="#status">Status</a> ·
  <a href="#known-gaps">Gaps</a>
</p>

<br />

<p align="center">
  <img src="assets/banner.png" alt="WARDEN" width="760" />
</p>

<br />

## Contents

1. [Why](#why)
2. [What it does](#what-it-does)
   - [`scan`](#scan)
   - [`vet-repo`](#vet-repo)
   - [`judge`](#judge)
   - [`watch`](#watch)
   - [`backtest`](#backtest)
3. [Architecture](#architecture)
4. [Launchpads](#launchpads)
5. [Status](#status)
6. [Run](#run)
7. [Configuration](#configuration)
8. [Known gaps](#known-gaps)
9. [Built on](#built-on)
10. [License](#license)

---

## Why

A launch-sniper README said one thing. The GitHub account said another.

- Dormant account, suddenly awake
- Six forks in a 19-minute window
- Token ticker dropped into the README
- Contract address sitting in the author's bio

Warden is the check that would have caught it: the same on-chain vigilance a sniper already needs, pointed at the *project* publicizing a launch as well as the *token*.

<!-- visual: drop a screenshot of the bodkin fingerprint here -->

<p align="center"><sub>slot — <code>assets/diagrams/why.png</code></sub></p>

---

## What it does

Each command is a separate surface. Click one, jump to it.

| Command | Reads | Writes | Money |
|---|---|---|---|
| [`scan`](#scan) | Chain | stdout | no |
| [`vet-repo`](#vet-repo) | GitHub | stdout | no |
| [`judge`](#judge) | scan + optional repo | `verdicts/*.json` | no |
| [`watch`](#watch) | new launches | Telegram + trade log | only with `--live` |
| [`backtest`](#backtest) | historical launches | stdout | no |

### `scan`

Reads a live launch. Curve progress, LP lock, holder concentration, dev-buy history, mint/blacklist facts, snipe-tax bps.

```sh
deno task start scan <token>
deno task start scan <token> --launchpad four-meme
deno task start scan <token> --normalized
```

`--normalized` prints the same field names on Pons and four.meme. Verified by an automated test that diffs both against real live launches.

<!-- visual: scan JSON screenshot -->

### `vet-repo`

Fingerprints a GitHub repo for the pattern in [Why](#why).

- Account age vs oldest visible repo
- Forks clustering inside a 30-minute window
- `$TICKER` in README/bio (sharp) vs raw `0x…` addresses (weak — legitimate protocol docs are full of them)
- Star-burst timing: **unavailable on purpose** — GitHub locked stargazer lists. Never treated as “no burst found.”

Verified against `Phosphenq/bodkin` (known-bad) and `ponsdotdev/ponsfamily` (known-legitimate).

```sh
deno task start vet-repo <owner>/<repo>
```

### `judge`

Claude turns a scan — plus an optional repo fingerprint — into a plain-language verdict with a reasoning log. Not a score.

```sh
deno task start judge <token> [--repo <owner>/<repo>]
```

Needs `ANTHROPIC_API_KEY`. Implementation is wired through the real pipeline. The live model call has not been exercised in this environment (no key in `.env`).

Logs land in `verdicts/<token>-<timestamp>.json`.

### `watch`

Polls for new Pons v2 launches, judges each one, alerts Telegram.

```sh
deno task start watch --once <token>     # one known launch, no waiting
deno task start watch                     # poll forever
deno task start watch --live --min-confidence 0.9 --buy-amount-eth 0.01
```

Dry-run by default. `--live` is the only path that can submit a `buy()`, and only when:

1. verdict is `low_risk`
2. confidence clears the threshold
3. the curve is native-ETH paired (not ERC20)

Every decision — attempted or not — is appended to `verdicts/trades.jsonl`.

Polling is verified against live chain state (and caught two real bugs). A Telegram message has never actually been delivered from this environment (no bot credentials). A real buy has never been broadcast, on purpose. See [Known gaps](#known-gaps).

### `backtest`

Replays real historical launches — found by walking `TokenLaunched` events backward, not synthetic data — through scan + judge.

Reports graduated / abandoned / active / too-recent. **Does not detect “rugs.”** That needs evidence this project does not have. See [Known gaps](#known-gaps).

```sh
deno task start backtest --since 2026-09-01
```

---

## Architecture

<!-- visual: replace the ascii with assets/diagrams/pipeline.png -->

```
new launch
    |
    v
on-chain multicall  --------->  repo fingerprint (if linked)
(LP lock, mint/blacklist,       (account age vs activity,
 ownership, holder conc.)        fork timing, $TICKER)
    |                                |
    +----------------+---------------+
                     v
            agent verdict + reasoning log
                     |
                     v
              Telegram alert
                     |
                     v
   low_risk && confidence >= threshold
       && native-ETH-paired
                     |
                     v
       (--live only) buy(), slippage-bounded
```

<p align="center"><sub>slot — <code>assets/diagrams/pipeline.png</code></sub></p>

`judge` / `watch` / execution are Pons-only for now. four.meme is on the read side only.

---

## Launchpads

Two protocols, chosen because they are *structurally* different — not the same shape with different addresses.

| | Pons v2 | four.meme |
|---|---|---|
| Chain | Robinhood Chain | BNB Smart Chain |
| LP lock | vault contract | burn via DEX pair |
| Owner privilege | deployer never has any | manager holds `Ownable` **while still on the curve** — expected, not a red flag |
| `--normalized` | same field set | same field set |
| `scan` | yes | yes |
| `judge` / `watch` / buy | yes | not yet |

<!-- visual: side-by-side lock-mechanism diagram -->

<p align="center"><sub>slot — <code>assets/diagrams/launchpads.png</code></sub></p>

---

## Status

Sourced from `feature_list.json`. Coding agents may only flip `passes` after end-to-end verification.

| Feature | `passes` | What’s actually proven |
|---|---|---|
| On-chain scan | yes | Live launches, independently re-checked |
| Repo fingerprint | yes | Known-bad + known-good GitHub repos |
| Multi-launchpad | yes | Pons + four.meme, live, identical normalized shape |
| `judge` | no | Wired. Model call blocked on `ANTHROPIC_API_KEY` |
| `watch` | no | Poll loop live. Telegram never delivered |
| `--live` buy | no | Gate unit-tested. Slippage bit-for-bit vs `simulateContract`. Never broadcast |
| `backtest` | no | Discovery + outcome logic tested. Judge inside it hits the same missing key |

---

## Run

Requires [Deno](https://deno.com) 2.x. No Node, no npm.

```sh
./init.sh
deno task start scan <token-address>
deno task start scan <token-address> --launchpad four-meme
deno task start scan <token-address> --normalized
deno task start vet-repo <owner>/<repo>
deno task start judge <token-address> [--repo <owner>/<repo>]
deno task start watch --once <token-address>
deno task start watch
deno task start watch --live --min-confidence 0.9 --buy-amount-eth 0.01 --slippage-bps 300
deno task start backtest --since 2026-09-01
deno task test
```

---

## Configuration

Copy `.env.example` → `.env`. Missing credentials fail with a specific error, not a crash. Without `--live`, `WALLET_PRIVATE_KEY` is never read.

| Variable | Needed by |
|---|---|
| `ANTHROPIC_API_KEY` | `judge`, `watch`, `backtest` |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | `watch` |
| `WALLET_PRIVATE_KEY` | `watch --live` only |
| `RPC_URL` | Pons / Robinhood Chain (public RPC works, rate-limits) |
| `FOURMEME_RPC_URL` | four.meme / BSC |
| `GITHUB_TOKEN` | `vet-repo` (optional; unauthenticated hits 403s) |
| `WARDEN_MODEL` | optional override, default `claude-sonnet-5` |

---

## Known gaps

Honest, not decorative. Expand a row.

<details>
<summary><strong>Snipe-tax cause is unconfirmed</strong></summary>

`currentSnipeTaxBps()` exists in deployed bytecode — confirmed with raw `eth_call` probes against 3 live curves, plus a negative control that unknown selectors actually revert. It is missing from the protocol’s current public source. Returns `0` on every curve checked so far; those launches were already past the ~15-second decay window, so `0` is consistent with “already decayed,” not proof the read is meaningless. Not yet confirmed on a launch checked within seconds of creation.

</details>

<details>
<summary><strong>Holder concentration uses real <code>totalSupply</code></strong></summary>

An earlier version divided by the sum of one Blockscout page and overstated concentration (~3 percentage points on a real token). Top-holder share is now exact; `sampledHolders` / `hasMoreHolders` still tell you whether the holder list was fully fetched.

</details>

<details>
<summary><strong>Star-burst timing is unavailable, on purpose</strong></summary>

GitHub restricted stargazer-listing around July 2026. REST 404s for third-party repos; GraphQL returns an empty list even when stars exist. `vet-repo` reports `starTimingAvailable: false`. Fork timing carries the burst signal instead.

</details>

<details>
<summary><strong>“First activity” is a proxy</strong></summary>

Oldest *currently visible* repo stands in for when the account became active. Wrong if the real first repo was deleted or made private.

</details>

<details>
<summary><strong>Pons v2 is whitelist-gated and unaudited</strong></summary>

Per the protocol’s own docs. Real launches are happening anyway — this tool’s numbers come from live chain state, not a spec.

</details>

<details>
<summary><strong>Public RPC rate-limits under <code>watch</code></strong></summary>

Reproduced live against `rpc.mainnet.chain.robinhood.com`. Retry/backoff already in place; `watch` logs and continues instead of crashing. For anything beyond light testing, set `RPC_URL` to a paid provider.

</details>

<details>
<summary><strong>Only native-ETH-paired launches can be bought</strong></summary>

Some launches quote in an ERC20 (~30% in one live sample). `watch --live` refuses those instead of sending a transaction that reverts — or worse, looks like it succeeded.

</details>

<details>
<summary><strong>Real execution has never been tested with real money</strong></summary>

Deliberate. `buy()` signature, slippage math (0 bps vs on-chain `simulateContract`), and 7 unit tests on the gate are verified. Broadcasting a funded transaction is a decision for whoever runs this with their own funds.

</details>

<details>
<summary><strong>Robinhood Chain <code>eth_getLogs</code> had a real outage during testing</strong></summary>

Not rate-limiting — `"internal server errror"` (their typo), then a leaked internal backend address in a timeout. `eth_blockNumber` kept working. Tests in `src/execute/buy.test.ts` and `src/watch/watch.test.ts` may fail for this reason. Check the raw RPC call outside this repo before assuming a regression.

</details>

<details>
<summary><strong>four.meme is scan-only, with extra gaps</strong></summary>

No mint/blacklist template check (tokens are individually-deployed proxy clones, at least two implementations in concurrent live use). Burn-percentage arithmetic was spot-checked against a known graduated pair — BSC PancakeSwap volume is too high for a public RPC `eth_getLogs` window to self-discover one. `judge` / `watch` / buy are not on four.meme yet.

</details>

<details>
<summary><strong><code>backtest</code> does not detect rugs</strong></summary>

That needs price history and holder-exit patterns this project has no verified source for. Pons already structurally blocks classic rug vectors (vault-locked LP, zero deployer mint/blacklist). Backtest reports graduated / abandoned / active / indeterminate, each with an on-chain evidence string.

</details>

---

## Built on

- [Pons v2 docs](https://docs.ponsfamily.com/v2)
- [ponsdotdev/ponsfamily](https://github.com/ponsdotdev/ponsfamily)
- [viem](https://viem.sh)
- [Robinhood Chain Blockscout](https://robinhoodchain.blockscout.com)
- [four.meme](https://four.meme)
- Claude API for `judge`

---

## License

[MIT](LICENSE) — © 2026 Warden contributors.

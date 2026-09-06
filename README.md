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

<p align="center">
  <img src="assets/cli.svg" alt="Warden terminal — judge session" width="760" />
</p>

<p align="center">
  <sub>
    Open the same session in a browser:
    <a href="assets/terminal.html"><code>assets/terminal.html</code></a>
    · or run <code>deno task demo</code>
  </sub>
</p>

Most launch tools stare at the curve and call it due diligence. Warden reads the token *and* the story around it — then writes down what it actually saw, including what it could not check.

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

The repo looked like a serious product. The activity log looked like a costume: an account that had been sitting still for years, then a burst of forks in the same twenty minutes, a ticker appearing in the README, a contract address parked in the author's bio. None of that is on-chain. A bonding-curve scan would have called the token fine.

That gap is the whole point of this project. Sniper bots already read LP locks, mint functions, and holder concentration because those are the cheap ways to get rugged. They almost never look at whether the *people* shipping the launch are real. Warden is that second look — same vigilance, pointed at the project publicizing the token, not just the contract.

- Dormant account, suddenly awake
- Six forks in a 19-minute window
- Token ticker dropped into the README
- Contract address sitting in the author's bio

If those four show up together, the README is advertising. The chain still has to be checked. Warden does both, and it will say when a check was impossible rather than quietly treating a missing signal as clean.

<!-- visual: drop a screenshot of the bodkin fingerprint here -->

<p align="center"><sub>slot — <code>assets/diagrams/why.png</code></sub></p>

---

## What it does

Warden is a CLI, not a dashboard. You point it at a token or a repo, it talks to the chain and to GitHub, and it prints JSON (or a Telegram message) you can actually read. Nothing here invents a risk score. The interesting output is a verdict with citations — *this field, this value, this is why it mattered*.

Each command is a separate surface. Click one, jump to it.

| Command | Reads | Writes | Money |
|---|---|---|---|
| [`scan`](#scan) | Chain | stdout | no |
| [`vet-repo`](#vet-repo) | GitHub | stdout | no |
| [`judge`](#judge) | scan + optional repo | `verdicts/*.json` | no |
| [`watch`](#watch) | new launches | Telegram + trade log | only with `--live` |
| [`backtest`](#backtest) | historical launches | stdout | no |

### `scan`

This is the on-chain half. No model, no GitHub, no wallet. You give it a token address and it reads the factory, the curve, the locker (or the burned LP pair), and a page of holders.

What comes back is the stuff you would otherwise click through a block explorer for: curve progress, whether LP is locked, holder concentration against real `totalSupply`, how many times the deployer bought their own launch, whether mint/blacklist even exist, current snipe-tax bps. Missing data is labeled missing — a failed holder fetch is `null`, not “zero concentration.”

```sh
deno task start scan <token>
deno task start scan <token> --launchpad four-meme
deno task start scan <token> --normalized
```

`--normalized` prints the same field names on Pons and four.meme, so a later judge or alert path does not have to special-case the launchpad. Verified by an automated test that runs both adapters against real live launches and diffs the keys directly — including the cases where the *values* honestly differ (four.meme’s owner is supposed to be active pre-graduation; Pons’s never is).

<!-- visual: scan JSON screenshot -->

### `vet-repo`

This is the off-chain half, and the reason the project exists. A launch that links a GitHub repo is making a claim: *we built this, here is the work*. `vet-repo` checks whether that claim survives contact with the account’s actual history. It does not scrape Twitter, it does not score “vibes,” and it will not pretend a GitHub API restriction is a clean bill of health.

- Account age vs oldest visible repo
- Forks clustering inside a 30-minute window
- `$TICKER` in README/bio (sharp) vs raw `0x…` addresses (weak — legitimate protocol docs are full of them)
- Star-burst timing: **unavailable on purpose** — GitHub locked stargazer lists. Never treated as “no burst found.”

Ground truth was not synthetic. `Phosphenq/bodkin` is the known-bad profile from [Why](#why). `ponsdotdev/ponsfamily` is a legitimate protocol repo whose README is full of real contract addresses — Warden has to *not* flag that as shilling. Works unauthenticated; a `GITHUB_TOKEN` is what you want for anything past a one-off, because some user endpoints 403 without one.

```sh
deno task start vet-repo <owner>/<repo>
```

### `judge`

`scan` and `vet-repo` are facts. `judge` is the part that has to weigh them without turning a missing field into a green light.

The model is forced to call a `record_verdict` tool: category, confidence 0–1, a paragraph a non-technical reader could act on, and a list of signals that each cite a real field. The system prompt bakes in the false-positives this project already hit — `lpLocked=false` before graduation is normal, `snipeTaxBps=0` after the decay window is expected, `holders=null` is not zero holders. Output that does not match that shape is rejected, not trusted.

```sh
deno task start judge <token> [--repo <owner>/<repo>]
```

Needs `ANTHROPIC_API_KEY`. The pipeline around the call is wired — real scan, optional real fingerprint, log file on disk. The live model call has not been exercised here (no key in `.env`). Until it has, `passes` stays false. See [Status](#status).

Logs land in `verdicts/<token>-<timestamp>.json`. If you did not pass `--repo`, the judge is told so explicitly. Silence is not “the repo looked fine.”

### `watch`

This is the unattended loop. It sits on the factory, waits for `TokenLaunched`, runs judge, and pushes the verdict to Telegram. A failed launch (bad RPC, missing API key, Telegram outage) is logged and skipped. It does not take the whole process down with it.

Dry-run is the default on purpose. Most people running this should never pass `--live`. The flag is an explicit, loud opt-in, not a config default that wakes up because a `.env` happened to contain a key.

```sh
deno task start watch --once <token>     # one known launch, no waiting
deno task start watch                     # poll forever
deno task start watch --live --min-confidence 0.9 --buy-amount-eth 0.01
```

Dry-run by default. `--live` is the only path that can submit a `buy()`, and only when:

1. verdict is `low_risk`
2. confidence clears the threshold
3. the curve is native-ETH paired (not ERC20)

Every decision — attempted or not — is appended to `verdicts/trades.jsonl`. There is no path where a launch is silently skipped without a reason on disk.

Polling is verified against live chain state. A live run is how two real bugs were found (empty `--once` falling into the infinite loop; public RPC 429s under sustained polling). A Telegram message has never actually been delivered from this environment. A real buy has never been broadcast, on purpose. See [Known gaps](#known-gaps).

### `backtest`

If judge is going to mean anything, it has to be checked against what actually happened — not against a spreadsheet of vibes. `backtest` finds real historical launches by walking factory events backward from latest, runs the same scan + judge path, and cross-tabulates the verdict against on-chain outcomes.

It will say a launch graduated, stalled out, is still active, or is too new to call. Each row carries an evidence string. It will **not** say “this rugged.” That word needs price history and holder-exit patterns this repo does not have a verified source for, and Pons already structurally blocks the classic rug vectors a check like that would look for. Lying about that would be worse than leaving it out.

```sh
deno task start backtest --since 2026-09-01
```

---

## Architecture

One launch in, one verdict out. The on-chain read and the repo fingerprint are independent; either can be missing. The agent is not allowed to treat a missing half as a pass. Telegram fires on every judged launch. A buy is a separate gate after that, off unless you said `--live`.

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

`judge` / `watch` / execution are Pons-only for now. four.meme is on the read side only — same normalized shape, no agent, no alerts, no buys. That is a scope cut, not a claim that four.meme is “done.”

---

## Launchpads

A second launchpad is useless if it is the first one with the addresses swapped. Pons locks LP in a vault and never gives the deployer mint or blacklist. four.meme burns LP through a DEX pair, and the token’s `Ownable` owner *is* the manager while the token is still on the curve. A naive “owner ≠ 0 is bad” check copied from Pons would flag every healthy four.meme launch.

So the adapter is thin on purpose. Shared fields only where the meaning is actually the same. Where it is not, the interpretation travels with the fact (`ownerPrivilege.expectedRightNow`) instead of being collapsed into a boolean a later consumer would misread.

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

Addresses and signatures on four.meme were re-checked live (`eth_call` / `eth_getCode` / storage reads), including a wrong “textbook EIP-1967 slot” guess that a live storage read corrected before it was ever encoded.

---

## Status

This project treats “it compiles” as a non-answer. `feature_list.json` is the source of truth: a feature is `passes: true` only after someone ran the real path — live chain, real GitHub, browser-equivalent end-to-end — not after unit tests alone. Agents are not allowed to edit the descriptions, only the `passes` bit.

What is green below was checked against live state. What is not green is implemented, but blocked on a credential or on a standing rule (no real money spent to tick a box).

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

Requires [Deno](https://deno.com) 2.x. No Node, no npm, no Docker. `./init.sh` is idempotent: it creates a `.env` from the example if you do not have one, installs deps, and does not ask questions.

Commands below assume you are at the repo root. `deno task demo` prints a turquoise terminal session (no chain, no keys) — same picture as the visual above. `judge` / `watch` / `backtest` will fail closed if the keys they need are missing — a specific error, not a stack trace.

```sh
./init.sh
deno task demo
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

Copy `.env.example` → `.env`. Do not commit `.env`. It is gitignored; keep it that way.

Missing credentials fail with a specific error, not a crash. Without `--live`, `WALLET_PRIVATE_KEY` is never read — having a key on disk is not enough to spend. The public Robinhood RPC is fine for a few scans and will 429 if you leave `watch` on it all afternoon. For anything you actually care about, point `RPC_URL` at a paid provider.

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

Every tool like this accumulates silent fiction: a function assumed missing because it was not in the public repo, a holder percentage divided by the wrong denominator, an empty GitHub list treated as “no burst.” The list below is the opposite of that. Things we know are incomplete, unconfirmed, or deliberately out of scope.

Expand a row. None of these are theoretical — they were hit on live chain or live GitHub while building this.

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

Warden does not vendor protocol contracts. It calls what is already deployed, through the ABI those contracts expose, and it re-checks the interesting bits against live chain when the public source and the bytecode disagree.

- [Pons v2 docs](https://docs.ponsfamily.com/v2)
- [ponsdotdev/ponsfamily](https://github.com/ponsdotdev/ponsfamily)
- [viem](https://viem.sh) for the chain reads
- [Robinhood Chain Blockscout](https://robinhoodchain.blockscout.com) for holders
- [four.meme](https://four.meme)
- Claude API for `judge`

---

## License

[MIT](LICENSE). Do whatever you want with the code. Do not take `--live` as a suggestion. Warden will not spend your money to prove it works.

© 2026 Warden contributors.

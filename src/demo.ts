#!/usr/bin/env -S deno run --allow-env

const C = {
  reset: "\x1b[0m",
  cyan: "\x1b[38;2;58;215;220m",
  cyanDim: "\x1b[38;2;31;143;148m",
  green: "\x1b[38;2;93;202;122m",
  red: "\x1b[38;2;255;107;107m",
  dim: "\x1b[38;2;154;154;154m",
  mute: "\x1b[38;2;106;106;106m",
  ink: "\x1b[38;2;232;232;232m",
  promptBg: "\x1b[48;2;42;42;42m",
};

function line(s = "") {
  console.log(s + C.reset);
}

line();
line(`${C.cyan} ╔══════════════════════════════════════════╗`);
line(`${C.cyan} ║       Welcome to Warden v0.1.0           ║`);
line(`${C.cyan} ╚══════════════════════════════════════════╝`);
line();
line(`${C.cyan}██╗    ██╗ █████╗ ██████╗ ██████╗ ███████╗███╗   ██╗`);
line(`${C.cyan}██║    ██║██╔══██╗██╔══██╗██╔══██╗██╔════╝████╗  ██║`);
line(`${C.cyan}██║ █╗ ██║███████║██████╔╝██║  ██║█████╗  ██╔██╗ ██║`);
line(`${C.cyan}██║███╗██║██╔══██╗██╔══██╗██║  ██║██╔══╝  ██║╚██╗██║`);
line(`${C.cyan}╚███╔███╔╝██║  ██║██║  ██║██████╔╝███████╗██║ ╚████║`);
line(`${C.cyan} ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═══╝`);
line();
line(`${C.dim}Agentic vetting for new token launches.`);
line(
  `${C.dim}Current model: ${C.cyan}claude-sonnet-5${C.mute}   Type --repo to attach a fingerprint.`,
);
line();
line(
  `${C.promptBg}${C.cyan}❯${C.ink} warden judge 0xc65AF5ed…8456 --repo Phosphenq/bodkin ${C.reset}`,
);
line();
line(
  `${C.cyan}●${C.ink} scanLaunch("0xc65AF5ed7d40A2A0C8E362B93b4AF70A40a58456")`,
);
line(`  ${C.mute}⌞ ${C.green}14 live contract reads in 1.8s`);
line(`${C.cyan}●${C.ink} vetRepo("Phosphenq/bodkin")`);
line(`  ${C.mute}⌞ ${C.green}6 forks in 19m · $BODKIN in README + bio`);
line(`${C.cyan}●${C.ink} record_verdict`);
line(
  `  ${C.mute}⌞ ${C.green}high_risk @ 0.91  ·  log: verdicts/0xc65A…-17256.json`,
);
line();
line(
  `${C.dim}●${C.ink} A 2019 account that sat still until last week, then six forks in`,
);
line(`  nineteen minutes and a ticker in the README. The curve looks ordinary.`);
line(`  The GitHub does not.`);
line();
line(`  ${C.dim}Snapshot`);
line(`  ${C.mute}─────────────────────────────────────────────`);
line(`  ${C.dim}progress            ${C.ink}12.4%`);
line(
  `  ${C.dim}lpLocked            ${C.ink}false   ${C.mute}phase=0, expected`,
);
line(`  ${C.dim}topHolderShare      ${C.ink}0.184`);
line(`  ${C.dim}dormancyGapDays     ${C.ink}2481`);
line(`  ${C.dim}forkBurst           ${C.ink}6 in 19 min`);
line(`  ${C.dim}tickerMentions      ${C.ink}$BODKIN × 2`);
line(`  ${C.mute}─────────────────────────────────────────────`);
line();
line(`  ${C.dim}Signals`);
line(
  `  ${C.mute}- ${C.ink}dormancyGapDays=2481 — created 2019, first visible repo 2026-09-03`,
);
line(`  ${C.mute}- ${C.ink}forkBurst.count=6 window=19m`);
line(`  ${C.mute}- ${C.ink}tickerMentions=$BODKIN in README and bio`);
line(`  ${C.mute}- ${C.ink}lpLocked=false, phase=0 — not a red flag`);
line(`  ${C.mute}- ${C.ink}mint/blacklist=false — Pons v2 template`);
line();
line(
  `  ${C.red}● HIGH RISK  ${C.mute}confidence 91%  ·  dry-run, no buy`,
);
line();

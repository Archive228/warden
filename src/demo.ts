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
  `${C.promptBg}${C.cyan}❯${C.ink} warden judge 0x1111…1111 --repo acme/launch ${C.reset}`,
);
line();
line(
  `${C.cyan}●${C.ink} scanLaunch("0x1111111111111111111111111111111111111111")`,
);
line(`  ${C.mute}⌞ ${C.green}14 live contract reads in 1.8s`);
line(`${C.cyan}●${C.ink} vetRepo("acme/launch")`);
line(`  ${C.mute}⌞ ${C.green}4 forks in 11m · $ACME in README`);
line(`${C.cyan}●${C.ink} record_verdict`);
line(
  `  ${C.mute}⌞ ${C.green}high_risk @ 0.91  ·  log: verdicts/0x1111…-17256.json`,
);
line();
line(
  `${C.dim}●${C.ink} Dormant GitHub, a tight fork burst, a ticker in the README.`,
);
line(`  The curve looks ordinary. The GitHub does not.`);
line();
line(`  ${C.dim}Snapshot`);
line(`  ${C.mute}─────────────────────────────────────────────`);
line(`  ${C.dim}progress            ${C.ink}12.4%`);
line(
  `  ${C.dim}lpLocked            ${C.ink}false   ${C.mute}phase=0, expected`,
);
line(`  ${C.dim}topHolderShare      ${C.ink}0.184`);
line(`  ${C.dim}dormancyGapDays     ${C.ink}1226`);
line(`  ${C.dim}forkBurst           ${C.ink}4 in 11 min`);
line(`  ${C.dim}tickerMentions      ${C.ink}$ACME × 1`);
line(`  ${C.mute}─────────────────────────────────────────────`);
line();
line(`  ${C.dim}Signals`);
line(
  `  ${C.mute}- ${C.ink}dormancyGapDays=1226 — created 2023, first visible repo 2026-08-19`,
);
line(`  ${C.mute}- ${C.ink}forkBurst.count=4 window=11m`);
line(`  ${C.mute}- ${C.ink}tickerMentions=$ACME in README`);
line(`  ${C.mute}- ${C.ink}lpLocked=false, phase=0 — not a red flag`);
line(`  ${C.mute}- ${C.ink}mint/blacklist=false — Pons v2 template`);
line();
line(
  `  ${C.red}● HIGH RISK  ${C.mute}confidence 91%  ·  dry-run, no buy`,
);
line();

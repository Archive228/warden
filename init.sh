#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — fill in ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, RPC_URL before running warden for real."
fi

deno install
echo "warden scaffolded and dependencies resolved. No features are wired up yet — see feature_list.json."

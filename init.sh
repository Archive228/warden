#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — fill in ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, RPC_URL before running warden for real."
fi

deno install
echo "warden ready. See feature_list.json for what's built vs. planned."

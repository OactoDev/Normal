#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CF="$ROOT/cloudflare"

cd "$CF"
npm install

if [[ -z "${HUB_TOKEN:-}" ]]; then
  HUB_TOKEN="$(openssl rand -hex 24)"
  echo "==> New HUB_TOKEN (save to $ROOT/.env): $HUB_TOKEN"
  printf '%s' "$HUB_TOKEN" | npx wrangler secret put HUB_TOKEN
else
  printf '%s' "$HUB_TOKEN" | npx wrangler secret put HUB_TOKEN
fi

DEPLOY_OUT="$(npx wrangler deploy 2>&1)"
echo "$DEPLOY_OUT"
WORKER_URL="$(echo "$DEPLOY_OUT" | grep -Eo 'https://[a-zA-Z0-9.-]+\.workers\.dev' | head -1)"
if [[ -n "$WORKER_URL" ]]; then
  ENV_FILE="$ROOT/.env"
  touch "$ENV_FILE"
  if grep -q '^HUB_URL=' "$ENV_FILE" 2>/dev/null; then
    sed -i '' "s|^HUB_URL=.*|HUB_URL=$WORKER_URL|" "$ENV_FILE"
  else
    echo "HUB_URL=$WORKER_URL" >> "$ENV_FILE"
  fi
  if [[ -n "${HUB_TOKEN:-}" ]] && ! grep -q '^HUB_TOKEN=' "$ENV_FILE" 2>/dev/null; then
    echo "HUB_TOKEN=$HUB_TOKEN" >> "$ENV_FILE"
  fi
fi

echo "==> Run: $ROOT/scripts/cloud-sync.sh"

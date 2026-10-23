#!/usr/bin/env bash
# Push hub markdown to Cloudflare Worker KV via /api/sync
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: missing $ENV_FILE — set HUB_URL and HUB_TOKEN after deploy" >&2
  exit 1
fi

while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%%#*}"
  [[ -z "${line// }" ]] && continue
  [[ "$line" != *=* ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  val="${val%\"}"; val="${val#\"}"
  val="${val%\'}"; val="${val#\'}"
  export "$key=$val"
done < "$ENV_FILE"

if [[ -z "${HUB_URL:-}" || -z "${HUB_TOKEN:-}" ]]; then
  echo "error: HUB_URL and HUB_TOKEN required in .env" >&2
  exit 1
fi

SPROUT_ROOT="${SPROUT_ROOT:-}"
SPROUT_SUMMARY="Sprout not configured"
if [[ -n "$SPROUT_ROOT" && -d "$SPROUT_ROOT/.git" ]]; then
  SPROUT_SUMMARY="$(git -C "$SPROUT_ROOT" log -1 --format='last commit %ci (%h) %s' 2>/dev/null || echo 'no commits')"
fi

python3 - "$ROOT" "$SPROUT_SUMMARY" <<'PY' | curl -fsSL -X POST "${HUB_URL%/}/api/sync" \
  -H "Authorization: Bearer ${HUB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @-
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
sprout = sys.argv[2]

def read(rel: str) -> str:
    p = root / rel
    return p.read_text(encoding="utf-8") if p.is_file() else ""

payload = {
    "live": read("digest/LIVE.md"),
    "action": read("ACTION-ITEMS.md"),
    "decisions": read("DECISIONS.md"),
    "review": read("planning/REVIEW-CHECKLIST.md"),
    "now": read("notifications/NOW.md"),
    "log": read("notifications/LOG.md"),
    "sprout": sprout,
}
print(json.dumps(payload))
PY
echo ""
echo "Synced to ${HUB_URL}"

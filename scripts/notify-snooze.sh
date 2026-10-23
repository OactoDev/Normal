#!/usr/bin/env bash
# Snooze banners for N minutes. Usage: notify-snooze.sh 120
set -euo pipefail

MINUTES="${1:-120}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE="$ROOT/notifications/state.json"
EXAMPLE="$ROOT/notifications/state.json.example"

if [[ ! -f "$STATE" ]]; then
  cp "$EXAMPLE" "$STATE"
fi

UNTIL="$(date -v+"${MINUTES}"M +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -d "+${MINUTES} minutes" +%Y-%m-%dT%H:%M:%S)"
python3 - "$STATE" "$UNTIL" <<'PY'
import json
import sys
from pathlib import Path

path, until = sys.argv[1], sys.argv[2]
data = json.loads(Path(path).read_text())
data["snooze_until"] = until
Path(path).write_text(json.dumps(data, indent=2) + "\n")
PY

echo "Snoozed until $UNTIL (London-local string; tick uses Europe/London)."

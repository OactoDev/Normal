#!/usr/bin/env bash
set -euo pipefail

LABEL="com.efi.nightshift-team-notify"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "LaunchAgent: $LABEL"
launchctl print "gui/$(id -u)/$LABEL" 2>/dev/null | head -20 || echo "  (not loaded — run ./scripts/notify-install.sh)"

echo ""
echo "State: $ROOT/notifications/state.json"
if [[ -f "$ROOT/notifications/state.json" ]]; then
  cat "$ROOT/notifications/state.json"
else
  echo "  (missing — install will copy from state.json.example)"
fi

echo ""
echo "Last lines of NOW.md:"
tail -n 12 "$ROOT/notifications/NOW.md" 2>/dev/null || true

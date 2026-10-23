#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.efi.nightshift-team-notify"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST="$PLIST_DIR/$LABEL.plist"
PYTHON="$(command -v python3)"
TICK="$ROOT/scripts/notify-tick.py"

mkdir -p "$PLIST_DIR"
if [[ ! -f "$ROOT/notifications/state.json" ]]; then
  cp "$ROOT/notifications/state.json.example" "$ROOT/notifications/state.json"
fi
chmod +x "$TICK" "$ROOT/scripts/notify-snooze.sh"

cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PYTHON</string>
    <string>$TICK</string>
  </array>
  <key>StartInterval</key>
  <integer>900</integer>
  <key>WorkingDirectory</key>
  <string>$ROOT</string>
  <key>StandardOutPath</key>
  <string>$ROOT/notifications/launchd.out.log</string>
  <key>StandardErrorPath</key>
  <string>$ROOT/notifications/launchd.err.log</string>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl enable "gui/$(id -u)/$LABEL"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

echo "Installed $LABEL (every 15 minutes)."
echo "Set SPROUT_ROOT in $ROOT/.env — see .env.example"
"$PYTHON" "$TICK"

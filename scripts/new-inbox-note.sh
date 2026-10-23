#!/usr/bin/env bash
# Scaffold a Discord inbox note. Usage: new-inbox-note.sh "#channel" "topic-slug"
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: $0 \"#channel\" \"topic-slug\"" >&2
  echo "example: $0 \"#announcements\" \"kickoff-rules\"" >&2
  exit 2
fi

CHANNEL="$1"
TOPIC="$2"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INBOX="$ROOT/sources/discord/inbox"
STAMP="$(date +%Y-%m-%d-%H%M)"
SAFE_TOPIC="$(echo "$TOPIC" | tr ' ' '-' | tr -cd '[:alnum:]-_' | tr '[:upper:]' '[:lower:]')"
FILE="$INBOX/${STAMP}-${SAFE_TOPIC}.md"

mkdir -p "$INBOX"

cat >"$FILE" <<EOF
# Discord capture — ${CHANNEL} — ${TOPIC}

- **Captured:** $(date -Iseconds)
- **Channel:** ${CHANNEL}
- **Author:** _(paste)_
- **Link:** _(optional message link)_

---

## Paste below

EOF

echo "Created $FILE"
echo "Edit the file, update digest/LIVE.md, then run ./scripts/merge-inbox.sh"

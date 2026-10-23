#!/usr/bin/env bash
# Fetch Luma event page text into sources/luma/latest.md and a dated snapshot.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
URL="https://luma.com/nightshift-london"
OUT_DIR="$ROOT/sources/luma"
LATEST="$OUT_DIR/latest.md"
SNAP_DIR="$OUT_DIR/snapshots"
DATE="$(date +%Y-%m-%d)"
SNAP="$SNAP_DIR/$DATE.md"

mkdir -p "$SNAP_DIR"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

if ! curl -fsSL --max-time 60 -A "NightShift-Team-Hub/1.0" "$URL" -o "$tmp"; then
  echo "error: failed to fetch $URL" >&2
  exit 1
fi

# Strip tags crudely; unescape common entities for readable markdown-ish text.
python3 - "$tmp" "$LATEST" <<'PY'
import html
import re
import sys
from pathlib import Path

src, dest = sys.argv[1], sys.argv[2]
raw = Path(src).read_text(encoding="utf-8", errors="replace")
text = re.sub(r"<script[^>]*>.*?</script>", " ", raw, flags=re.I | re.S)
text = re.sub(r"<style[^>]*>.*?</style>", " ", text, flags=re.I | re.S)
text = re.sub(r"<[^>]+>", "\n", text)
text = html.unescape(text)
lines = [ln.strip() for ln in text.splitlines()]
collapsed: list[str] = []
for ln in lines:
    if not ln:
        if collapsed and collapsed[-1] != "":
            collapsed.append("")
        continue
    collapsed.append(ln)
body = "\n".join(collapsed).strip()
header = f"# Luma snapshot\n\nSource: https://luma.com/nightshift-london\nFetched: {__import__('datetime').datetime.now().isoformat(timespec='seconds')}\n\n---\n\n"
Path(dest).write_text(header + body + "\n", encoding="utf-8")
PY

cp "$LATEST" "$SNAP"
echo "Wrote $LATEST"
echo "Wrote $SNAP"
echo "Next: diff snapshots, update SCHEDULE.md, digest/LIVE.md, digest/CHANGELOG.md if needed."

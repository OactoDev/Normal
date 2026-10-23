#!/usr/bin/env bash
# Move processed inbox notes to archive/ after they are reflected in digest/LIVE.md.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INBOX="$ROOT/sources/discord/inbox"
ARCHIVE="$ROOT/sources/discord/archive"

mkdir -p "$ARCHIVE"

shopt -s nullglob
files=("$INBOX"/*.md)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "No .md files in $INBOX (nothing to merge)."
  exit 0
fi

echo "Inbox files:"
for f in "${files[@]}"; do
  echo "  - $(basename "$f")"
done
echo ""
echo "Checklist before archiving:"
echo "  [ ] digest/LIVE.md updated with summary + link to source file"
echo "  [ ] ACTION-ITEMS.md updated if needed"
echo "  [ ] digest/CHANGELOG.md has a line for this change"
echo ""
read -r -p "Archive all inbox .md files above? [y/N] " ans
if [[ "${ans,,}" != "y" ]]; then
  echo "Aborted."
  exit 0
fi

for f in "${files[@]}"; do
  base="$(basename "$f")"
  dest="$ARCHIVE/$base"
  if [[ -e "$dest" ]]; then
    dest="$ARCHIVE/${base%.md}-$(date +%H%M%S).md"
  fi
  mv "$f" "$dest"
  echo "Archived -> $dest"
done

echo "Done."

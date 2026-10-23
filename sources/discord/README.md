# Discord capture

We do **not** use a bot. Copy announcements from the Mubit hackathon Discord into markdown files.

## Quick start

```bash
./scripts/new-inbox-note.sh "#announcements" "kickoff-rules"
# edit the new file under inbox/, paste content
# update digest/LIVE.md, commit
./scripts/merge-inbox.sh
```

## File naming

`YYYY-MM-DD-HHMM-channel-topic.md` (created by `new-inbox-note.sh`).

## Privacy

- Redact other participants’ emails or private DMs unless they are official host posts.
- Do not paste API keys, tokens, or `.env` contents — describe where to set them locally instead.

## Folders

| Folder | Purpose |
|--------|---------|
| `inbox/` | New, unmerged captures |
| `archive/` | Merged into LIVE; kept for provenance |

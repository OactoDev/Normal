# Night Shift Mubit London 2026 — Team hub

Shared event intel for **Efi** and **Izia**: Luma official copy, Discord announcements, schedule, decisions, and action items.

**Official event:** [Night Shift on Luma](https://luma.com/nightshift-london)

## Open in Cursor

Clone this repo, open the folder as your workspace (or add it alongside Sprout in a multi-root window).

```bash
git clone git@github.com:shahaman098/night-shift-mubit-2026-team.git
# or: git clone https://github.com/shahaman098/night-shift-mubit-2026-team.git
cd night-shift-mubit-2026-team
```

**Repo:** https://github.com/shahaman098/night-shift-mubit-2026-team (private)

## Start here

| File | Purpose |
|------|---------|
| [digest/LIVE.md](digest/LIVE.md) | Single source of truth — read before planning builds |
| [ACTION-ITEMS.md](ACTION-ITEMS.md) | Shared checklist |
| [SCHEDULE.md](SCHEDULE.md) | Event timeline (update when hosts email changes) |
| [RULES.md](RULES.md) | Submission and Mubit constraints |
| [TEAM.md](TEAM.md) | Roles and comms |

## Discord inbox (manual)

1. Run `./scripts/new-inbox-note.sh "#announcements" "short-topic"` (or create a file under `sources/discord/inbox/`).
2. Paste the Discord message (redact other hackers’ emails if any).
3. Update [digest/LIVE.md](digest/LIVE.md) under **Discord updates**; add tasks to [ACTION-ITEMS.md](ACTION-ITEMS.md) if needed.
4. Commit, then run `./scripts/merge-inbox.sh` to archive processed inbox files.

## Luma refresh

```bash
./scripts/pull-luma.sh
```

Diff `sources/luma/latest.md` against the previous snapshot, then patch `SCHEDULE.md`, `digest/LIVE.md`, and [digest/CHANGELOG.md](digest/CHANGELOG.md).

## Build repo (submission)

Application code lives in **Sprout** (separate repo/folder). This hub only holds event intel and team coordination — not HackForge research runs.

## GitHub

After clone:

1. **Invite Izia:** GitHub → Settings → Collaborators → Add people, or `gh api repos/:owner/:repo/collaborators/:username -X PUT` (requires admin).
2. Never commit `.env`, API keys, or Mubit tokens — use local env only.

## Secrets

Copy `.env.example` to `.env` locally (gitignored) for optional placeholders like Mubit base URL.

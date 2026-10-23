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
| [notifications/NOW.md](notifications/NOW.md) | Auto dashboard — idea/code/planning evaluation |
| [planning/REVIEW-CHECKLIST.md](planning/REVIEW-CHECKLIST.md) | Deep review when nudged |

## Persistent notifications

macOS banners + `notifications/NOW.md` + `notifications/LOG.md` for schedule milestones, idea review, and Sprout code checkpoints.

```bash
cp .env.example .env   # set SPROUT_ROOT
./scripts/notify-install.sh   # every 15 min via launchd
./scripts/notify-status.sh
```

See [notifications/README.md](notifications/README.md). Snooze: `./scripts/notify-snooze.sh 120`.

## Cloud hub (Izia + Efi)

Deployed on Cloudflare (**amanshah0844@gmail.com**): password-protected dashboard + cron evaluation.

| | |
|--|--|
| URL | https://night-shift-team-hub.kiritokris.workers.dev |
| Auth | `Authorization: Bearer $HUB_TOKEN` (in your local `.env`, share token privately) |
| Sync | `./scripts/cloud-sync.sh` after local edits |
| Deploy | `./scripts/cloud-deploy.sh` |

Details: [cloudflare/README.md](cloudflare/README.md).

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

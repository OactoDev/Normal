# Persistent notifications

macOS banners + **`notifications/NOW.md`** + **`notifications/LOG.md`** so planning, idea review, and code checkpoints do not rely on memory.

## Install (each laptop: Efi + Izia)

```bash
./scripts/notify-install.sh   # launchd every 15 min during the event window
./scripts/notify-status.sh
```

Uninstall:

```bash
./scripts/notify-uninstall.sh
```

## Manual tick

```bash
./scripts/notify-tick.py           # evaluate + maybe notify
./scripts/notify-tick.py --dry-run # print what would fire
NOTIFY_FORCE=1 ./scripts/notify-tick.py  # run outside event window
```

## Snooze (2 hours)

```bash
./scripts/notify-snooze.sh 120
```

## Configure

Copy `.env.example` → `.env`:

- `SPROUT_ROOT` — path to Sprout for git-age code checkpoints
- `NOTIFY_ENABLED=1` — set `0` to only update NOW.md without banners

Schedule edits: [schedule.json](schedule.json) (one-shots + recurring intervals).

## What gets evaluated each tick

- Unchecked items in [ACTION-ITEMS.md](../ACTION-ITEMS.md)
- Whether [DECISIONS.md](../DECISIONS.md) still empty
- Whether Discord intel merged into [digest/LIVE.md](../digest/LIVE.md)
- Sprout last commit age (if `SPROUT_ROOT` set)

Deep review: [planning/REVIEW-CHECKLIST.md](../planning/REVIEW-CHECKLIST.md)

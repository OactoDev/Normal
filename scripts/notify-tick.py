#!/usr/bin/env python3
"""Evaluate hub + Sprout health; push macOS notifications; update NOW.md and LOG.md."""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
NOTIFY_DIR = ROOT / "notifications"
SCHEDULE_PATH = NOTIFY_DIR / "schedule.json"
STATE_PATH = NOTIFY_DIR / "state.json"
NOW_PATH = NOTIFY_DIR / "NOW.md"
LOG_PATH = NOTIFY_DIR / "LOG.md"
ENV_PATH = ROOT / ".env"


def load_dotenv() -> dict[str, str]:
    out: dict[str, str] = {}
    if not ENV_PATH.is_file():
        return out
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        out[key.strip()] = val.strip().strip('"').strip("'")
    return out


def load_json(path: Path, default: dict) -> dict:
    if not path.is_file():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def save_state(state: dict) -> None:
    STATE_PATH.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")


def parse_local_dt(iso: str, tz: ZoneInfo) -> datetime:
    # schedule uses naive local times
    dt = datetime.fromisoformat(iso)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=tz)
    return dt


def count_action_items() -> tuple[int, int]:
    text = (ROOT / "ACTION-ITEMS.md").read_text(encoding="utf-8")
    open_ = len(re.findall(r"^- \[ \]", text, re.M))
    done = len(re.findall(r"^- \[x\]", text, re.I | re.M))
    return open_, done


def decisions_empty() -> bool:
    text = (ROOT / "DECISIONS.md").read_text(encoding="utf-8")
    return "_(No decisions logged yet.)_" in text or "## Template" in text and "Decision:" not in text.split("---", 1)[-1]


def discord_unmerged() -> bool:
    text = (ROOT / "digest" / "LIVE.md").read_text(encoding="utf-8")
    inbox = list((ROOT / "sources" / "discord" / "inbox").glob("*.md"))
    stale_live = "_(none yet" in text.lower() or "(none yet" in text.lower()
    return bool(inbox) or stale_live


def sprout_status(sprout_root: str | None) -> dict[str, str]:
    if not sprout_root:
        return {"configured": "no", "summary": "Set SPROUT_ROOT in .env for code-age checks."}
    path = Path(sprout_root).expanduser()
    if not (path / ".git").is_dir():
        return {"configured": "yes", "summary": f"SPROUT_ROOT not a git repo: {path}"}
    try:
        proc = subprocess.run(
            ["git", "-C", str(path), "log", "-1", "--format=%ci|%h|%s"],
            capture_output=True,
            text=True,
            check=False,
            timeout=10,
        )
    except (subprocess.TimeoutExpired, OSError) as exc:
        return {"configured": "yes", "summary": f"git error: {exc}"}
    if proc.returncode != 0:
        return {"configured": "yes", "summary": "no commits in Sprout yet"}
    when, short, subj = (proc.stdout.strip() + "||").split("|")[:3]
    return {
        "configured": "yes",
        "last_commit": when,
        "short": short,
        "subject": subj,
        "summary": f"last commit {when} ({short}) {subj}",
    }


def build_evaluation(env: dict[str, str]) -> dict:
    open_items, done_items = count_action_items()
    sprout = sprout_status(env.get("SPROUT_ROOT") or os.environ.get("SPROUT_ROOT"))
    return {
        "action_open": open_items,
        "action_done": done_items,
        "decisions_empty": decisions_empty(),
        "discord_attention": discord_unmerged(),
        "sprout": sprout,
    }


def render_now(now: datetime, eval_data: dict, pending: list[dict]) -> str:
    lines = [
        "# NOW — auto-generated dashboard",
        "",
        f"**Updated:** {now.isoformat(timespec='seconds')} (London)",
        "",
        "## Evaluation",
        "",
        f"- **Action items:** {eval_data['action_open']} open, {eval_data['action_done']} done",
        f"- **DECISIONS.md:** {'still empty — log your track/idea' if eval_data['decisions_empty'] else 'has entries'}",
        f"- **Discord / LIVE:** {'needs attention (inbox or LIVE stub)' if eval_data['discord_attention'] else 'ok'}",
        f"- **Sprout:** {eval_data['sprout']['summary']}",
        "",
        "## Do next",
        "",
    ]
    if eval_data["decisions_empty"]:
        lines.append("1. Fill [planning/REVIEW-CHECKLIST.md](../planning/REVIEW-CHECKLIST.md) → [DECISIONS.md](../DECISIONS.md)")
    if eval_data["action_open"]:
        lines.append(f"1. Clear or assign **{eval_data['action_open']}** open items in [ACTION-ITEMS.md](../ACTION-ITEMS.md)")
    if eval_data["discord_attention"]:
        lines.append("1. Merge Discord → [digest/LIVE.md](../digest/LIVE.md)")
    lines.append("1. Open Sprout — verify Mubit base URL + one correction demo path")
    lines.append("")
    if pending:
        lines.extend(["## Fired this tick", ""])
        for item in pending:
            lines.append(f"- **{item['title']}** — {item['body']}")
        lines.append("")
    lines.extend(
        [
            "## Standing links",
            "",
            "- [REVIEW-CHECKLIST.md](../planning/REVIEW-CHECKLIST.md)",
            "- [digest/LIVE.md](../digest/LIVE.md)",
            "- [SCHEDULE.md](../SCHEDULE.md)",
            "",
        ]
    )
    return "\n".join(lines)


def append_log(now: datetime, notif_id: str, title: str) -> None:
    row = f"| {now.strftime('%Y-%m-%d %H:%M')} | {notif_id} | {title} |"
    text = LOG_PATH.read_text(encoding="utf-8")
    if row not in text:
        LOG_PATH.write_text(text.rstrip() + "\n" + row + "\n", encoding="utf-8")


def macos_notify(title: str, body: str) -> None:
    safe_title = title.replace('"', '\\"')
    safe_body = body.replace('"', '\\"')
    script = f'display notification "{safe_body}" with title "{safe_title}" sound name "Glass"'
    subprocess.run(["osascript", "-e", script], check=False)


def in_event_window(now: datetime, start: datetime, end: datetime) -> bool:
    return start <= now <= end


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    env = {**load_dotenv(), **{k: v for k, v in os.environ.items() if k.startswith(("SPROUT_", "NOTIFY_"))}}
    schedule = load_json(SCHEDULE_PATH, {})
    tz = ZoneInfo(schedule.get("timezone", "Europe/London"))
    now = datetime.now(tz)

    state = load_json(STATE_PATH, json.loads((NOTIFY_DIR / "state.json.example").read_text()))
    snooze = state.get("snooze_until")
    if snooze:
        until = parse_local_dt(snooze, tz)
        if now < until:
            eval_data = build_evaluation(env)
            NOW_PATH.write_text(
                render_now(now, eval_data, []) + f"\n**Snoozed until:** {snooze}\n",
                encoding="utf-8",
            )
            return 0

    start = parse_local_dt(schedule["event_start"], tz)
    end = parse_local_dt(schedule["event_end"], tz)
    force = os.environ.get("NOTIFY_FORCE") == "1"
    if not force and not in_event_window(now, start - timedelta(hours=2), end + timedelta(hours=1)):
        eval_data = build_evaluation(env)
        NOW_PATH.write_text(
            render_now(now, eval_data, [])
            + "\n_Outside event window — no banners (use NOTIFY_FORCE=1 to test)._ \n",
            encoding="utf-8",
        )
        state["last_tick_at"] = now.isoformat()
        if not args.dry_run:
            save_state(state)
        return 0

    eval_data = build_evaluation(env)
    fired: list[dict] = []
    fired_ids: set[str] = set(state.get("fired_one_shots", []))
    recurring_last: dict[str, str] = state.get("recurring_last", {})

    one_shot_grace = timedelta(hours=3)
    for item in schedule.get("one_shots", []):
        at = parse_local_dt(item["at"], tz)
        nid = item["id"]
        if nid in fired_ids or now < at:
            continue
        if now - at > one_shot_grace:
            fired_ids.add(nid)
            continue
        body = item["body"]
        if eval_data["action_open"]:
            body += f" ({eval_data['action_open']} open action items.)"
        fired.append({"id": nid, "title": item["title"], "body": body})
        fired_ids.add(nid)

    for item in schedule.get("recurring", []):
        nid = item["id"]
        every = int(item["every_minutes"])
        last_s = recurring_last.get(nid)
        if not last_s:
            recurring_last[nid] = now.isoformat()
            continue
        last = parse_local_dt(last_s, tz)
        if now - last < timedelta(minutes=every):
            continue
        body = item["body"]
        if nid == "action-sync" and eval_data["action_open"]:
            body = f"{eval_data['action_open']} open — update ACTION-ITEMS.md and LIVE.md"
        if nid == "code-checkpoint":
            body = f"{eval_data['sprout']['summary']}"
        fired.append({"id": nid, "title": item["title"], "body": body})
        recurring_last[nid] = now.isoformat()

    notify_enabled = env.get("NOTIFY_ENABLED", "1") != "0"

    if not args.dry_run:
        NOW_PATH.write_text(render_now(now, eval_data, fired), encoding="utf-8")
        state["fired_one_shots"] = sorted(fired_ids)
        state["recurring_last"] = recurring_last
        state["last_tick_at"] = now.isoformat()
        save_state(state)

    for item in fired:
        if args.dry_run:
            print(f"WOULD NOTIFY [{item['id']}] {item['title']}: {item['body']}")
            continue
        if notify_enabled:
            macos_notify(item["title"], item["body"])
        append_log(now, item["id"], item["title"])

    if args.dry_run and not fired:
        print("No notifications due this tick.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

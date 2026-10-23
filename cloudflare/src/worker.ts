import schedule from "../schedule.json";

export interface Env {
  HUB: KVNamespace;
  HUB_TOKEN: string;
}

type Schedule = typeof schedule;

interface NotifyState {
  fired_one_shots: string[];
  recurring_last: Record<string, string>;
  snooze_until: string | null;
  last_tick_at: string | null;
}

interface FiredAlert {
  id: string;
  title: string;
  body: string;
}

const KV = {
  live: "file:digest/LIVE.md",
  action: "file:ACTION-ITEMS.md",
  decisions: "file:DECISIONS.md",
  review: "file:planning/REVIEW-CHECKLIST.md",
  now: "file:notifications/NOW.md",
  log: "file:notifications/LOG.md",
  sprout: "meta:sprout_summary",
  state: "state:notify",
  alerts: "state:alerts_json",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unauthorized(): Response {
  return new Response("Unauthorized", { status: 401 });
}

function checkAuth(request: Request, env: Env): boolean {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token.length > 0 && token === env.HUB_TOKEN;
}

/** London local time as `YYYY-MM-DDTHH:mm:ss` for schedule comparison. */
function londonIsoLocal(d = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .format(d)
    .replace(" ", "T");
}

function londonMsFromIsoLocal(iso: string): number {
  const [date, time] = iso.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm, ss] = (time ?? "00:00:00").split(":").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm, ss ?? 0);
  for (const offsetHours of [0, -1, 1]) {
    const candidate = new Date(utcGuess + offsetHours * 3600_000);
    if (londonIsoLocal(candidate).startsWith(iso.slice(0, 16))) {
      return candidate.getTime();
    }
  }
  return utcGuess;
}

function countActions(md: string): { open: number; done: number } {
  const open = (md.match(/^- \[ \]/gm) ?? []).length;
  const done = (md.match(/^- \[[xX]\]/gm) ?? []).length;
  return { open, done };
}

function decisionsEmpty(md: string): boolean {
  return md.includes("_(No decisions logged yet.)_");
}

function discordAttention(live: string): boolean {
  return /\(none yet/i.test(live);
}

async function loadState(hub: KVNamespace): Promise<NotifyState> {
  const raw = await hub.get(KV.state);
  if (!raw) {
    return { fired_one_shots: [], recurring_last: {}, snooze_until: null, last_tick_at: null };
  }
  return JSON.parse(raw) as NotifyState;
}

async function saveState(hub: KVNamespace, state: NotifyState): Promise<void> {
  await hub.put(KV.state, JSON.stringify(state));
}

async function runTick(env: Env): Promise<{ nowMd: string; fired: FiredAlert[] }> {
  const hub = env.HUB;
  const actionMd = (await hub.get(KV.action)) ?? "";
  const liveMd = (await hub.get(KV.live)) ?? "";
  const decisionsMd = (await hub.get(KV.decisions)) ?? "";
  const sproutSummary =
    (await hub.get(KV.sprout)) ?? "Sync from laptop with scripts/cloud-sync.sh (includes Sprout git summary).";

  const { open, done } = countActions(actionMd);
  const now = new Date();
  const nowLondon = londonIsoLocal(now);
  const nowIso = now.toISOString();

  const state = await loadState(hub);
  if (state.snooze_until) {
    const until = new Date(state.snooze_until);
    if (now.getTime() < until.getTime()) {
      const nowMd = `# NOW (cloud)\n\nSnoozed until ${state.snooze_until}\n`;
      await hub.put(KV.now, nowMd);
      return { nowMd, fired: [] };
    }
  }

  const startMs = londonMsFromIsoLocal(schedule.event_start) - 2 * 60 * 60 * 1000;
  const endMs = londonMsFromIsoLocal(schedule.event_end) + 60 * 60 * 1000;
  const nowMs = now.getTime();

  const fired: FiredAlert[] = [];
  const firedSet = new Set(state.fired_one_shots);
  const graceMs = 3 * 60 * 60 * 1000;

  if (nowMs >= startMs && nowMs <= endMs) {
    for (const item of schedule.one_shots) {
      const atMs = londonMsFromIsoLocal(item.at);
      if (firedSet.has(item.id) || nowMs < atMs) continue;
      if (nowMs - atMs > graceMs) {
        firedSet.add(item.id);
        continue;
      }
      let body = item.body;
      if (open > 0) body += ` (${open} open action items.)`;
      fired.push({ id: item.id, title: item.title, body });
      firedSet.add(item.id);
    }

    for (const item of schedule.recurring) {
      const last = state.recurring_last[item.id];
      if (!last) {
        state.recurring_last[item.id] = nowIso;
        continue;
      }
      const elapsed = now.getTime() - new Date(last).getTime();
      if (elapsed < item.every_minutes * 60 * 1000) continue;
      let body = item.body;
      if (item.id === "action-sync" && open > 0) {
        body = `${open} open — update ACTION-ITEMS and LIVE`;
      }
      if (item.id === "code-checkpoint") {
        body = sproutSummary;
      }
      fired.push({ id: item.id, title: item.title, body });
      state.recurring_last[item.id] = nowIso;
    }
  }

  const lines = [
    "# NOW — cloud dashboard",
    "",
    `**Updated:** ${nowIso}`,
    "",
    "## Evaluation",
    "",
    `- **Action items:** ${open} open, ${done} done`,
    `- **DECISIONS:** ${decisionsEmpty(decisionsMd) ? "empty — log track/idea" : "has entries"}`,
    `- **Discord / LIVE:** ${discordAttention(liveMd) ? "needs attention" : "ok"}`,
    `- **Sprout:** ${sproutSummary}`,
    "",
    "## Do next",
    "",
  ];
  if (decisionsEmpty(decisionsMd)) lines.push("1. Complete REVIEW-CHECKLIST → DECISIONS");
  if (open > 0) lines.push(`1. Assign or clear ${open} ACTION-ITEMS`);
  if (discordAttention(liveMd)) lines.push("1. Merge Discord → LIVE.md → cloud-sync");
  lines.push("1. Verify Mubit correction demo path in Sprout");
  if (fired.length) {
    lines.push("", "## Alerts this tick", "");
    for (const f of fired) lines.push(`- **${f.title}** — ${f.body}`);
  }

  const nowMd = lines.join("\n") + "\n";
  await hub.put(KV.now, nowMd);
  await hub.put(KV.alerts, JSON.stringify(fired));

  const log = (await hub.get(KV.log)) ?? "| When (UTC) | ID | Title |\n|------------|-----|-------|\n";
  let newLog = log;
  for (const f of fired) {
    const row = `| ${nowIso.slice(0, 16).replace("T", " ")} | ${f.id} | ${f.title} |`;
    if (!log.includes(row)) newLog += row + "\n";
  }
  await hub.put(KV.log, newLog);

  state.fired_one_shots = [...firedSet].sort();
  state.last_tick_at = nowIso;
  await saveState(hub, state);

  return { nowMd, fired };
}

function dashboardHtml(sections: Record<string, string>, alerts: FiredAlert[]): string {
  const alertHtml =
    alerts.length === 0
      ? "<p class=\"muted\">No new alerts this tick.</p>"
      : `<ul>${alerts.map((a) => `<li><strong>${escapeHtml(a.title)}</strong> — ${escapeHtml(a.body)}</li>`).join("")}</ul>`;

  const body = Object.entries(sections)
    .map(
      ([title, md]) =>
        `<section><h2>${escapeHtml(title)}</h2><pre>${escapeHtml(md || "(empty — run cloud-sync from repo)")}</pre></section>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Night Shift Team Hub</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 1rem 2rem; max-width: 960px; background: #0f1419; color: #e7ecf3; }
    h1 { font-size: 1.4rem; }
    h2 { font-size: 1.1rem; margin-top: 1.5rem; color: #8ab4ff; }
    pre { white-space: pre-wrap; background: #1a2332; padding: 1rem; border-radius: 8px; font-size: 0.9rem; }
    .alerts { background: #2a2218; border: 1px solid #c9a227; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
    .muted { color: #9aa5b1; }
    a { color: #8ab4ff; }
  </style>
</head>
<body>
  <h1>Night Shift — Team hub (cloud)</h1>
  <p class="muted">Cron every 15m on Cloudflare · sync from git via <code>scripts/cloud-sync.sh</code></p>
  <div class="alerts"><h2>Alerts</h2>${alertHtml}</div>
  ${body}
</body>
</html>`;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runTick(env));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("ok");
    }

    if (!checkAuth(request, env)) {
      return unauthorized();
    }

    if (url.pathname === "/api/tick" && request.method === "POST") {
      const result = await runTick(env);
      return Response.json({ ok: true, fired: result.fired });
    }

    if (url.pathname === "/api/sync" && request.method === "POST") {
      const payload = (await request.json()) as Record<string, string>;
      const allowed = ["live", "action", "decisions", "review", "now", "log", "sprout"] as const;
      for (const key of allowed) {
        if (payload[key] !== undefined) {
          const map: Record<string, string> = {
            live: KV.live,
            action: KV.action,
            decisions: KV.decisions,
            review: KV.review,
            now: KV.now,
            log: KV.log,
            sprout: KV.sprout,
          };
          await env.HUB.put(map[key], payload[key]);
        }
      }
      await runTick(env);
      return Response.json({ ok: true });
    }

    if (url.pathname === "/api/now") {
      const now = (await env.HUB.get(KV.now)) ?? "";
      const alerts = JSON.parse((await env.HUB.get(KV.alerts)) ?? "[]") as string;
      return Response.json({ now, alerts });
    }

    const [live, action, decisions, now, log, alertsRaw] = await Promise.all([
      env.HUB.get(KV.live),
      env.HUB.get(KV.action),
      env.HUB.get(KV.decisions),
      env.HUB.get(KV.now),
      env.HUB.get(KV.log),
      env.HUB.get(KV.alerts),
    ]);
    const alerts = JSON.parse(alertsRaw ?? "[]") as FiredAlert[];

    const html = dashboardHtml(
      {
        NOW: now ?? "",
        LIVE: live ?? "",
        "Action items": action ?? "",
        Decisions: decisions ?? "",
        Log: log ?? "",
      },
      alerts,
    );
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};

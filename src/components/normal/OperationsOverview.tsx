"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { money, num, pct, virtualDate } from "@/lib/format";
import { api, q, sevClass, statusClass, type AnomalyRow, type Capabilities, type IncidentRow, type InvestigationRow, type MonitorStatus } from "./api";
import { useRun } from "./run-context";

interface RunState { run: { simulationRunId: string; seed: number; status: string; virtualTime: string }; tickIndex: number; totals?: Record<string, number>; locked: boolean; isActiveRun: boolean }
interface Breakdown { window: { startAt: string; endAt: string }; total: { counters: Record<string, number>; rates: Record<string, number | null>; window: { startAt: string; endAt: string } } | null; daily: unknown[] }
interface Data { state: RunState; breakdown: Breakdown; monitor: MonitorStatus; incidents: IncidentRow[]; anomalies: { total: number; items: AnomalyRow[] }; investigations: { total: number; items: InvestigationRow[] }; capabilities: Capabilities }

export function OperationsOverview() {
  const { runId, withRun, loaded } = useRun();
  const [result, setResult] = useState<{ runId: string; data: Data | null; error: string | null } | null>(null);
  const selected = useRef<string | null>(null);
  const requestSequence = useRef(0);

  const load = useCallback(async (id: string) => {
    const sequence = ++requestSequence.current;
    try {
      const run = q({ simulationRunId: id });
      const [state, breakdown, monitor, incidents, anomalies, investigations, capabilities] = await Promise.all([
        api<RunState>(`/api/dev/simulator/state?${run}`), api<Breakdown>(`/api/metrics/breakdown?${run}&days=7`), api<MonitorStatus>(`/api/dev/monitor/run?${run}`),
        api<{ items: IncidentRow[] }>(`/api/incidents?${run}&limit=10`), api<{ total: number; items: AnomalyRow[] }>(`/api/anomalies?${run}&limit=8`),
        api<{ total: number; items: InvestigationRow[] }>(`/api/investigations?${run}&limit=8`), api<Capabilities>(`/api/intelligence/capabilities?${run}`),
      ]);
      if (selected.current !== id || requestSequence.current !== sequence) return;
      setResult({ runId: id, data: { state, breakdown, monitor, incidents: incidents.items, anomalies, investigations, capabilities }, error: null });
    } catch (e) { if (selected.current === id && requestSequence.current === sequence) setResult({ runId: id, data: null, error: (e as Error).message }); }
  }, []);
  useLayoutEffect(() => { selected.current = runId; requestSequence.current++; }, [runId]);
  useEffect(() => { if (!runId) return; void (async () => { await load(runId); })(); }, [runId, load]);
  useEffect(() => { if (!runId) return; const t = setInterval(() => void load(runId), 10_000); return () => clearInterval(t); }, [runId, load]);

  if (loaded && !runId) return <div className="empty" data-testid="overview-empty">No simulation runs exist yet. Create one in the <Link href="/dev/simulator">control room</Link>.</div>;
  const current = result && result.runId === runId ? result : null;
  if (current?.error) return <div className="alert error" data-testid="overview-error">{current.error}</div>;
  if (!current?.data) return <div className="muted" data-testid="overview-loading">Loading run data…</div>;
  const { state, breakdown, monitor, incidents, anomalies, investigations, capabilities } = current.data;
  const total = breakdown.total;
  const activeIncidents = incidents.filter((i) => i.status === "monitoring" || i.status === "investigating");
  const stage = (id: string) => capabilities.stages.find((s) => s.id === id)!;
  return (
    <>
      <div className="card" data-testid="overview-run">
        <div className="card-head"><h3>Run</h3><span>{state.isActiveRun ? "storefront active run" : "not the storefront run"}</span></div>
        <div className="card-body row" style={{ flexWrap: "wrap", gap: 10 }}>
          <span className="pill">run <code>{state.run.simulationRunId}</code></span><span className="pill">seed {state.run.seed}</span><span className="pill">tick {state.tickIndex}</span>
          <span className="pill accent" data-testid="overview-virtual-time">virtual {virtualDate(state.run.virtualTime)}</span>
          <span className={`pill ${state.locked ? "warn" : "ok"}`}>{state.locked ? "tick in progress" : "simulator idle"}</span>
          <Link href="/dev/simulator" className="btn sm">Open control room</Link>
        </div>
      </div>

      <div className="grid kpis" data-testid="overview-kpis">
        <div className="card kpi"><span className="label">Net revenue (7 virtual days)</span><span className="value">{total ? money(total.counters.revenueMinor) : "—"}</span><span className="sub">{total ? `${num(total.counters.orders)} orders · refunds ${money(total.counters.refundMinor)}` : "no metrics yet"}</span></div>
        <div className="card kpi"><span className="label">Sessions</span><span className="value">{total ? num(total.counters.sessions) : "—"}</span><span className="sub">conversion {total ? pct(total.rates.conversionRate, 2) : "—"}</span></div>
        <div className="card kpi"><span className="label">Advertising</span><span className="value">{total ? money(total.counters.adSpendMinor) : "—"}</span><span className="sub">CTR {total ? pct(total.rates.ctr, 2) : "—"} · CPA {total?.rates.costPerAcquisitionMinor != null ? money(total.rates.costPerAcquisitionMinor) : "—"}</span></div>
        <div className="card kpi"><span className="label">Fulfilment</span><span className="value">{total ? pct(total.rates.lateDeliveryRate) : "—"}</span><span className="sub">late · {total ? `${num(total.counters.delayedShipments)} of ${num(total.counters.shipments)} promises due` : "—"}</span></div>
        <div className="card kpi"><span className="label">Reviews</span><span className="value">{total ? pct(total.rates.lowRatingRate) : "—"}</span><span className="sub">low-rating share · {total ? `${num(total.counters.reviews)} reviews` : "—"}</span></div>
        <div className="card kpi"><span className="label">Latest metric snapshot</span><span className="value" style={{ fontSize: 16 }}>{total ? virtualDate(total.window.endAt) : "—"}</span><span className="sub">window {total ? `${virtualDate(total.window.startAt)} →` : "—"}</span></div>
      </div>

      <div className="grid two">
        <div className="card" data-testid="overview-monitoring">
          <div className="card-head"><h3>Monitoring</h3><Link href="/dev/monitor" className="btn sm">Open anomaly monitor</Link></div>
          <div className="card-body" style={{ display: "grid", gap: 6 }}>
            <span className="small">Direct trigger: <strong>{monitor.methodA?.enabled ? "enabled" : "disabled"}</strong> · Change Stream worker: <span className={`pill ${monitor.worker?.connected ? "ok" : "warn"}`} data-testid="overview-worker">{monitor.worker?.connected ? "connected (recent heartbeat)" : "no current connection confirmed"}</span></span>
            <span className="small">Analysed up to <strong>{virtualDate(monitor.lastAsOf)}</strong> · latest observed hour {virtualDate(monitor.watermark)} · last scan {monitor.lastScanAt ? new Date(monitor.lastScanAt).toLocaleString("en-GB") : "never"}</span>
            <span className="small">Jobs: {monitor.jobs?.pending ?? 0} pending · {monitor.jobs?.running ?? 0} running · {monitor.jobs?.completed ?? 0} completed · {monitor.jobs?.failed ?? 0} failed</span>
            <span className="small">Metrics persisted: {num(Number(stage("observe").metrics.snapshots ?? 0))} snapshots over {num(Number(stage("observe").metrics.events ?? 0))} events</span>
            {monitor.failedJobs?.map((j) => <div key={j.jobKey} className="alert error">Attempt {j.attempts}: {j.lastError}</div>)}
          </div>
        </div>
        <div className="card" data-testid="overview-pipeline">
          <div className="card-head"><h3>Pipeline readiness</h3><Link href={withRun("/dashboard/architecture")} className="btn sm">Open architecture</Link></div>
          <div className="card-body" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {capabilities.stages.map((s) => <Link key={s.id} href={withRun(`/dashboard/architecture?stage=${s.id}`)} className={`pill ${statusClass(s.status)}`} title={s.summary}>{s.name}: {s.status.replaceAll("_", " ")}</Link>)}
          </div>
        </div>
      </div>

      <div className="card" data-testid="overview-incidents">
        <div className="card-head"><h3>Incidents</h3><span>{activeIncidents.length} active · {incidents.length} shown</span></div>
        <div className="card-body" style={{ display: "grid", gap: 8 }}>
          {incidents.length === 0 ? <div className="muted small">No incidents for this run.</div> : null}
          {incidents.map((i) => (
            <div key={i.incidentId} className="order" data-testid="overview-incident">
              <div className="row" style={{ justifyContent: "space-between" }}><strong>{i.title}</strong><div className="row"><span className={`pill ${sevClass(i.severity.level)}`}>{i.severity.level} · {i.severity.score}</span><span className="pill">{i.status}</span></div></div>
              <span className="small">{i.findingIds.length} findings · {i.anomalyIds.length} anomalies · since {virtualDate(i.onsetAt)}</span>
              {i.investigationId ? <Link className="btn sm" style={{ justifySelf: "start" }} href={withRun(`/dashboard/investigations/${encodeURIComponent(i.investigationId)}`)} data-testid="open-investigation">Open investigation workspace</Link> : <span className="muted small">No investigation opened.</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid two">
        <div className="card" data-testid="overview-anomalies">
          <div className="card-head"><h3>Recent anomalies</h3><span>{anomalies.total} canonical</span></div>
          <div className="card-body scroll-x">
            {anomalies.items.length === 0 ? <div className="muted small">No anomalies recorded.</div> : (
              <table><thead><tr><th>Metric</th><th>Segment</th><th className="num">Change</th><th>Severity</th><th>Detected</th></tr></thead>
                <tbody>{anomalies.items.map((a) => <tr key={a.anomaly.anomalyId}><td>{a.finding?.label ?? a.anomaly.metric}</td><td>{a.finding?.segmentLabel ?? "—"}</td><td className="num">{a.anomaly.changePercent > 0 ? "+" : ""}{a.anomaly.changePercent.toFixed(1)}%</td><td><span className={`pill ${sevClass(a.anomaly.severity)}`}>{a.anomaly.severity}</span></td><td>{virtualDate(a.anomaly.detectedAt)}</td></tr>)}</tbody></table>
            )}
          </div>
        </div>
        <div className="card" data-testid="overview-investigations">
          <div className="card-head"><h3>Recent investigations</h3><span>{investigations.total} total</span></div>
          <div className="card-body scroll-x">
            {investigations.items.length === 0 ? <div className="muted small">No investigations opened for this run.</div> : (
              <table><thead><tr><th>Title</th><th>Status</th><th className="num">Anomalies</th><th className="num">Evidence</th><th></th></tr></thead>
                <tbody>{investigations.items.map((i) => <tr key={i.investigation.investigationId}><td>{i.investigation.title}<div className="muted small"><code>{i.investigation.investigationId}</code></div></td><td><span className="pill">{i.investigation.status.replaceAll("_", " ")}</span></td><td className="num">{i.investigation.anomalyIds.length}</td><td className="num">{i.investigation.evidenceIds.length}</td><td><Link className="btn sm" href={withRun(`/dashboard/investigations/${encodeURIComponent(i.investigation.investigationId)}`)}>Open</Link></td></tr>)}</tbody></table>
            )}
          </div>
        </div>
      </div>
      <div className="row"><Link href="/demo-store" className="btn sm">Demo store</Link><Link href="/dev/simulator" className="btn sm">Nike simulator</Link><Link href="/dev/monitor" className="btn sm">Monitoring console</Link></div>
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { money, num, pct, virtualDate } from "@/lib/format";
import { api, q, STATUS_LABEL, statusClass, type Capabilities, type InvestigationRow, type MonitorStatus } from "./api";
import { useRun } from "./run-context";

interface Resource<T> { path: string; data: T | null; error: string | null }

function useScopedResource<T>(makePath: (runId: string) => string) {
  const { runId, loaded, withRun } = useRun();
  const path = runId ? makePath(runId) : null;
  const [resource, setResource] = useState<Resource<T> | null>(null);
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    void api<T>(path).then((data) => {
      if (!cancelled) setResource({ path, data, error: null });
    }).catch((error: unknown) => {
      if (!cancelled) setResource({ path, data: null, error: error instanceof Error ? error.message : "Request failed" });
    });
    return () => { cancelled = true; };
  }, [path]);
  const current = resource?.path === path ? resource : null;
  return { runId, loaded, withRun, data: current?.data ?? null, error: current?.error ?? null };
}

function ResourceState({ loaded, runId, error }: { loaded: boolean; runId: string | null; error: string | null }) {
  if (error) return <div className="alert error">{error}</div>;
  if (!loaded) return <div className="muted">Loading selected run…</div>;
  if (!runId) return <div className="section-empty">Select a simulation run to view its records.</div>;
  return <div className="muted">Loading selected run…</div>;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <article className="card section-stat"><small>{label}</small><strong>{value}</strong></article>;
}

interface InvestigationList { total: number; items: InvestigationRow[] }

export function InvestigationIndex() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { runId, loaded, withRun, data, error } = useScopedResource<InvestigationList>((id) => `/api/investigations?${q({ simulationRunId: id, limit: 50 })}`);
  if (!data) return <div className="section-page"><ResourceState loaded={loaded} runId={runId} error={error} /></div>;
  const evidenceCount = data.items.reduce((total, item) => total + item.investigation.evidenceIds.length, 0);
  const activeCount = data.items.filter((item) => !["completed", "closed"].includes(item.investigation.status)).length;
  const filtered = data.items.filter(({ investigation, incident }) => {
    const search = query.trim().toLowerCase();
    const matchesQuery = !search || [investigation.title, investigation.investigationId, incident?.primaryTheme ?? ""].some((value) => value.toLowerCase().includes(search));
    const matchesStatus = statusFilter === "all" || investigation.status === statusFilter;
    return matchesQuery && matchesStatus;
  });
  const statuses = [...new Set(data.items.map(({ investigation }) => investigation.status))].sort();
  return <div className="section-page" data-testid="investigations-page">
    <p className="section-intro">Persisted investigations linked to the selected simulation run. Open a record to review its incident, evidence, and collection history.</p>
    <div className="section-stats"><Stat label="Investigations" value={data.total} /><Stat label="Open records" value={activeCount} /><Stat label="Signals in recent records" value={num(data.items.reduce((total, item) => total + item.investigation.anomalyIds.length, 0))} /><Stat label="Evidence links" value={num(evidenceCount)} /></div>
    <article className="card section-card"><div className="section-card-head"><div><h2>Investigation records</h2><p className="muted small">{data.total} records · selected run {runId}</p></div></div>
      {data.items.length ? <><div className="section-toolbar"><label className="section-search"><span className="sr-only">Search investigations</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, theme, or ID" /></label><label className="section-filter">Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{statuses.map((status) => <option value={status} key={status}>{status.replaceAll("_", " ")}</option>)}</select></label><span className="muted small">Showing {filtered.length} of {data.items.length}</span></div><div className="scroll-x"><table className="section-table"><thead><tr><th>Investigation</th><th>Severity</th><th>Status</th><th>Signals</th><th>Evidence</th><th>Updated</th><th></th></tr></thead><tbody>{filtered.map(({ investigation, incident }) => <tr key={investigation.investigationId}><td><strong>{investigation.title}</strong><small><code>{investigation.investigationId}</code></small></td><td><span className={`section-tag ${incident?.severity.level ?? "unknown"}`}>{incident?.severity.level ?? "No incident"}</span></td><td><span className={`section-tag status-${investigation.status}`}>{investigation.status.replaceAll("_", " ")}</span></td><td>{investigation.anomalyIds.length}</td><td>{investigation.evidenceIds.length}</td><td>{virtualDate(investigation.updatedAt)}</td><td><Link className="btn sm" href={withRun(`/dashboard/investigations/${encodeURIComponent(investigation.investigationId)}`)}>Review</Link></td></tr>)}</tbody></table></div>{filtered.length === 0 ? <div className="section-empty">No records match these filters.</div> : null}</> : <div className="section-empty">No investigations have been persisted for this run yet.</div>}
    </article>
  </div>;
}

export function ApprovalsPage() {
  const { runId, loaded, withRun, data, error } = useScopedResource<Capabilities>((id) => `/api/intelligence/capabilities?${q({ simulationRunId: id })}`);
  if (!data) return <div className="section-page"><ResourceState loaded={loaded} runId={runId} error={error} /></div>;
  const stages = ["plan", "approve", "execute"].map((id) => data.stages.find((stage) => stage.id === id)).filter((stage) => stage !== undefined);
  const approvalStage = stages.find((stage) => stage.id === "approve");
  return <div className="section-page" data-testid="approvals-page">
    <p className="section-intro">Review the plan, approval, and execution stages for the selected run. This page reflects recorded system capability and handoff status.</p>
    <div className="section-stats approval-summary"><Stat label="Approval queue" value="Unavailable" /><Stat label="Selected run" value={runId ? `${runId.slice(0, 12)}…` : "—"} /><Stat label="Approval stage" value={approvalStage ? STATUS_LABEL[approvalStage.status] : "Not reported"} /><Stat label="Decision records" value="None" /></div>
    <article className="card section-card"><div className="section-card-head"><h2>Plan and approval handoff</h2></div>
      <div className="section-callout">{approvalStage?.status === "partner_pending" ? "Approval and execution are pending the partner integration. No approval queue or decision is currently exposed for this run." : approvalStage?.summary ?? "No approval stage status is available for this run."}</div>
      <div className="section-stats stage-status-grid">{stages.map((stage) => <article className="card section-stat" key={stage.id}><small>{stage.name}</small><span className={`section-tag ${statusClass(stage.status)}`}>{STATUS_LABEL[stage.status] ?? stage.status}</span><p className="muted small">{stage.summary}</p><dl className="stage-meta"><div><dt>Backend</dt><dd>{stage.backend}</dd></div><div><dt>Implemented</dt><dd>{stage.implemented ? "Yes" : "No"}</dd></div></dl></article>)}</div>
      <div className="section-links"><Link className="btn" href={withRun("/dashboard/architecture?stage=plan")}>Review architecture stages</Link><Link className="btn" href={withRun("/dashboard/investigations")}>Open investigations</Link></div>
    </article>
  </div>;
}

interface ActivityEvent { eventId: string; type: string; occurredAt: string; source: string; payload: Record<string, unknown>; provenance: { ingestMethod: string } }
interface ActivityResponse { simulationRunId: string | null; events: ActivityEvent[] }

export function ActivityPage() {
  const [sourceFilter, setSourceFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const { runId, loaded, data, error } = useScopedResource<ActivityResponse>((id) => `/api/dev/simulator/events?${q({ simulationRunId: id, limit: 100 })}`);
  if (!data) return <div className="section-page"><ResourceState loaded={loaded} runId={runId} error={error} /></div>;
  const sources = new Set(data.events.map((event) => event.source));
  const types = [...new Set(data.events.map((event) => event.type))].sort();
  const visibleEvents = data.events.filter((event) => {
    const search = query.trim().toLowerCase();
    return (sourceFilter === "all" || event.source === sourceFilter) && (typeFilter === "all" || event.type === typeFilter) && (!search || `${event.type} ${event.source} ${event.eventId}`.toLowerCase().includes(search));
  });
  return <div className="section-page" data-testid="activity-page">
    <p className="section-intro">Canonical business events, newest first. Entries are scoped to the selected simulation run.</p>
    <div className="section-stats"><Stat label="Recent events" value={num(data.events.length)} /><Stat label="Sources" value={sources.size} /><Stat label="Run" value={runId ?? "—"} /><Stat label="Most recent event" value={data.events[0] ? virtualDate(data.events[0].occurredAt) : "—"} /></div>
    <article className="card section-card"><div className="section-card-head"><div><h2>Event activity</h2><p className="muted small">Latest 100 canonical events · newest first</p></div></div>
      {data.events.length ? <><div className="section-toolbar"><label className="section-search"><span className="sr-only">Search events</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search event, source, or ID" /></label><label className="section-filter">Source<select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="all">All sources</option>{[...sources].sort().map((source) => <option key={source}>{source}</option>)}</select></label><label className="section-filter">Event type<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All event types</option>{types.map((type) => <option key={type}>{type}</option>)}</select></label><span className="muted small">{visibleEvents.length} events</span></div><div className="section-timeline">{visibleEvents.map((event) => <details className="section-timeline-item" key={event.eventId}><summary><time>{virtualDate(event.occurredAt)}</time><strong>{event.type.replaceAll(".", " · ").replaceAll("_", " ")}</strong><span className="section-tag">{event.source}</span><span className="muted small">{event.provenance.ingestMethod.replaceAll("_", " ")}</span></summary><div className="event-detail"><code>{event.eventId}</code><pre>{JSON.stringify(event.payload, null, 2)}</pre></div></details>)}</div>{visibleEvents.length === 0 ? <div className="section-empty">No events match these filters.</div> : null}</> : <div className="section-empty">No canonical events have been recorded for this run.</div>}
    </article>
  </div>;
}

interface SignalAnomaly {
  anomalyId: string; metric: string; direction: string; severity: string; status: string;
  actualValue: number; baselineValue: number; changePercent: number; detectedAt: string;
  currentWindow: { startAt: string; endAt: string }; baselineWindow: { startAt: string; endAt: string };
}
interface SignalListItem { anomaly: SignalAnomaly; finding: { label: string; segmentLabel: string; theme: string; reason: string; incidentId: string | null } | null }
interface SignalList { total: number; limit: number; offset: number; items: SignalListItem[] }
interface SignalSnapshot { snapshotId: string; window: { startAt: string; endAt: string }; currency: string; counters: Record<string, number>; rates: Record<string, number | null> }
interface SignalDetail { anomaly: SignalAnomaly; simulationRunId: string; snapshots: SignalSnapshot[]; finding: { label: string; segmentLabel: string; theme: string; reason: string; evaluation: { baseline: { method: string; estimator: string; n: number } | null }; evidence: { baselineDerivation: string; sourceRecords: Array<{ collection: string; recordId: string }> } } | null }

const signalValue = (metric: string, snapshot: SignalSnapshot): number | null => {
  switch (metric) {
    case "revenue_minor": return snapshot.counters.revenueMinor ?? null;
    case "orders": return snapshot.counters.orders ?? null;
    case "cac_minor": return snapshot.rates.costPerAcquisitionMinor ?? null;
    case "ctr": return snapshot.rates.ctr ?? null;
    case "conversion_rate": return snapshot.rates.conversionRate ?? null;
    case "late_delivery_rate": return snapshot.rates.lateDeliveryRate ?? null;
    case "low_rating_rate": return snapshot.rates.lowRatingRate ?? null;
    case "ad_spend_minor": return snapshot.counters.adSpendMinor ?? null;
    default: return null;
  }
};

function signalMetricLabel(metric: string) {
  return ({ revenue_minor: "Revenue", conversion_rate: "Conversion rate", orders: "Orders", cac_minor: "Cost per acquisition", ctr: "Click-through rate", late_delivery_rate: "Late delivery rate", low_rating_rate: "Low-rating share", ad_spend_minor: "Ad spend" } as Record<string, string>)[metric] ?? metric.replaceAll("_", " ");
}

function formatSignalValue(metric: string, value: number | null | undefined, currency = "GBP") {
  if (value == null || !Number.isFinite(value)) return "—";
  if (metric.endsWith("_minor")) return money(value, currency);
  if (metric === "conversion_rate" || metric === "ctr" || metric.endsWith("_rate")) return pct(value, 2);
  return num(value);
}

function SignalChart({ signal, snapshots }: { signal: SignalAnomaly; snapshots: SignalSnapshot[] }) {
  const points = snapshots.map((snapshot) => ({ snapshot, value: signalValue(signal.metric, snapshot) })).filter((point): point is { snapshot: SignalSnapshot; value: number } => point.value != null);
  if (points.length === 0) return <div className="signal-chart-empty">No canonical metric snapshots are linked to this signal.</div>;
  const times = points.map(({ snapshot }) => Date.parse(snapshot.window.startAt));
  const start = Math.min(...times);
  const end = Math.max(...times, Date.parse(signal.currentWindow.endAt));
  const span = Math.max(1, end - start);
  const values = [...points.map((point) => point.value), signal.baselineValue];
  const extent = Math.max(...values) - Math.min(...values) || Math.max(1, Math.abs(values[0]) * 0.1);
  const min = Math.min(...values) - extent * 0.12;
  const max = Math.max(...values) + extent * 0.12;
  const xAt = (time: number) => 58 + ((time - start) / span) * 686;
  const yAt = (value: number) => 218 - ((value - min) / (max - min)) * 174;
  const coords = points.map(({ snapshot, value }) => ({ x: xAt(Date.parse(snapshot.window.startAt)), y: yAt(value), value, snapshot }));
  const path = coords.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const baselineY = yAt(signal.baselineValue);
  const currentX = xAt(Date.parse(signal.currentWindow.startAt));
  return <div className="signal-chart-wrap">
    <div className="signal-chart-legend"><span><i className="legend-current" />Observed source snapshots</span><span><i className="legend-baseline" />Detector baseline · {formatSignalValue(signal.metric, signal.baselineValue)}</span></div>
    <svg className="signal-chart" viewBox="0 0 800 280" role="img" aria-label={`${signalMetricLabel(signal.metric)} source snapshots over time with detector baseline`}>
      {[0, 1, 2, 3].map((line) => { const y = 44 + line * 58; return <g key={line}><line className="chart-grid-line" x1="58" x2="744" y1={y} y2={y} /><text className="chart-axis-label" x="0" y={y + 4}>{formatSignalValue(signal.metric, max - ((max - min) * line) / 3)}</text></g>; })}
      <rect className="chart-current-window" x={Math.max(58, currentX)} y="34" width={Math.max(0, 744 - Math.max(58, currentX))} height="203" rx="8" />
      <line className="chart-baseline-line" x1="58" x2="744" y1={baselineY} y2={baselineY} />
      {path ? <path className="signal-chart-line" d={path} /> : null}
      {coords.map((point) => <circle className={`signal-chart-point${point.snapshot.window.startAt >= signal.currentWindow.startAt ? " current" : ""}`} key={point.snapshot.snapshotId} cx={point.x} cy={point.y} r="5"><title>{`${virtualDate(point.snapshot.window.startAt)} · ${formatSignalValue(signal.metric, point.value, point.snapshot.currency)}`}</title></circle>)}
      <text className="chart-date-label" x="58" y="263">{new Date(start).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}</text>
      <text className="chart-date-label" x="744" y="263" textAnchor="end">{new Date(end).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}</text>
      <text className="chart-window-label" x={Math.min(744, Math.max(58, currentX + 8))} y="28">CURRENT WINDOW</text>
    </svg>
    <p className="signal-chart-source">Source: canonical metric snapshots <code>{points.length}</code> · {signal.baselineWindow.startAt === signal.currentWindow.startAt ? "single detector window" : "baseline and current windows"}</p>
  </div>;
}

export function SignalsPage() {
  const { runId, loaded } = useRun();
  const [status, setStatus] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [listState, setListState] = useState<{ key: string; data: SignalList | null; error: string | null } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailState, setDetailState] = useState<{ key: string; data: SignalDetail | null; error: string | null } | null>(null);
  const listKey = runId ? `${runId}:${status}:${severity}:${offset}` : "";
  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    const params = q({ simulationRunId: runId, limit: 7, offset, status: status === "all" ? undefined : status, severity: severity === "all" ? undefined : severity });
    void api<SignalList>(`/api/anomalies?${params}`).then((data) => {
      if (cancelled) return;
      setListState({ key: listKey, data, error: null });
      setSelectedId(data.items[0]?.anomaly.anomalyId ?? null);
    }).catch((error: unknown) => { if (!cancelled) setListState({ key: listKey, data: null, error: error instanceof Error ? error.message : "Request failed" }); });
    return () => { cancelled = true; };
  }, [runId, status, severity, offset, listKey]);
  const list = listState?.key === listKey ? listState.data : null;
  const listError = listState?.key === listKey ? listState.error : null;
  const visibleItems = (list?.items ?? []).filter(({ anomaly, finding }) => `${finding?.label ?? ""} ${finding?.segmentLabel ?? ""} ${anomaly.metric} ${anomaly.anomalyId}`.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = visibleItems.find(({ anomaly }) => anomaly.anomalyId === selectedId) ?? visibleItems[0] ?? null;
  const detailKey = runId && selected ? `${runId}:${selected.anomaly.anomalyId}` : "";
  const selectedAnomalyId = selected?.anomaly.anomalyId ?? null;
  useEffect(() => {
    if (!runId || !selectedAnomalyId) return;
    const key = `${runId}:${selectedAnomalyId}`;
    let cancelled = false;
    void api<SignalDetail>(`/api/anomalies/${encodeURIComponent(selectedAnomalyId)}?${q({ simulationRunId: runId })}`).then((data) => { if (!cancelled) setDetailState({ key, data, error: null }); })
      .catch((error: unknown) => { if (!cancelled) setDetailState({ key, data: null, error: error instanceof Error ? error.message : "Request failed" }); });
    return () => { cancelled = true; };
  }, [runId, selectedAnomalyId]);
  const detail = detailState?.key === detailKey ? detailState.data : null;
  const sourceEvents = detail?.finding?.evidence.sourceRecords.filter((source) => source.collection === "business_events") ?? [];
  const directionText = selected?.anomaly.direction === "increase" ? "increased" : "decreased";
  if (!list) return <div className="section-page"><ResourceState loaded={loaded} runId={runId} error={listError} /></div>;
  return <div className="section-page signals-page" data-testid="signals-page">
    <div className="signals-workspace">
      <aside className="card signals-list-panel" aria-label="All signals">
        <div className="signals-list-heading"><div><h2>Signals</h2><span>{list.total ? `${offset + 1}–${Math.min(offset + list.items.length, list.total)} of ${num(list.total)}` : "No signals"}</span></div></div>
        <label className="section-search signal-search"><span className="sr-only">Search signals</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search signals" /></label>
        <div className="signal-filter-row"><label><span className="sr-only">Filter by status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0); }}><option value="all">All statuses</option><option value="new">New</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></label><label><span className="sr-only">Filter by severity</span><select value={severity} onChange={(event) => { setSeverity(event.target.value); setOffset(0); }}><option value="all">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label></div>
        <div className="signal-list-scroll">{visibleItems.map(({ anomaly, finding }) => <button className={`signal-select-row${selected?.anomaly.anomalyId === anomaly.anomalyId ? " selected" : ""}`} key={anomaly.anomalyId} onClick={() => setSelectedId(anomaly.anomalyId)} aria-pressed={selected?.anomaly.anomalyId === anomaly.anomalyId}>
          <span className="signal-select-primary"><span className={`section-tag ${anomaly.severity}`}>{anomaly.severity}</span><strong title={finding?.label ?? signalMetricLabel(anomaly.metric)}>{finding?.label ?? signalMetricLabel(anomaly.metric)}</strong><small>{anomaly.status.replaceAll("_", " ")}</small></span><span className="signal-row-meta">{finding?.segmentLabel ?? signalMetricLabel(anomaly.metric)} · {anomaly.direction} {anomaly.changePercent > 0 ? "+" : ""}{anomaly.changePercent.toFixed(1)}% · {virtualDate(anomaly.detectedAt)}</span>
        </button>)}{visibleItems.length === 0 ? <div className="section-empty">No signals match this search.</div> : null}</div>
        <div className="signals-pagination"><button className="btn sm" onClick={() => setOffset(Math.max(0, offset - 7))} disabled={offset === 0}>Previous</button><span>Page {Math.floor(offset / 7) + 1} / {Math.max(1, Math.ceil(list.total / 7))}</span><button className="btn sm" onClick={() => setOffset(offset + 7)} disabled={offset + 7 >= list.total}>Next</button></div>
      </aside>
      <section className="card signal-detail-panel" aria-live="polite">
        {!selected ? <div className="section-empty">No signal selected.</div> : <>
          <div className="signal-detail-heading"><div><span className="eyebrow">{selected.finding?.theme ?? "Detected metric"} · {signalMetricLabel(selected.anomaly.metric)}</span><h2>{selected.finding?.label ?? signalMetricLabel(selected.anomaly.metric)}</h2><p>{selected.finding?.segmentLabel ?? "All segments"} · detected {virtualDate(selected.anomaly.detectedAt)}</p></div><span className={`section-tag ${selected.anomaly.severity}`}>{selected.anomaly.severity} severity</span></div>
          {detailState?.error && detailState.key === detailKey ? <div className="alert error">{detailState.error}</div> : null}
          <dl className="signal-metrics"><div><dt>Observed</dt><dd>{formatSignalValue(selected.anomaly.metric, selected.anomaly.actualValue)}</dd></div><div><dt>Baseline</dt><dd>{formatSignalValue(selected.anomaly.metric, selected.anomaly.baselineValue)}</dd></div><div><dt>Change</dt><dd className={selected.anomaly.direction === "increase" ? "signal-change-up" : "signal-change-down"}>{selected.anomaly.changePercent > 0 ? "+" : ""}{selected.anomaly.changePercent.toFixed(1)}%</dd></div><div><dt>Status</dt><dd className={`signal-state-${selected.anomaly.status}`}>{selected.anomaly.status.replaceAll("_", " ")}</dd></div></dl>
          <article className="signal-chart-card"><div className="section-card-head"><div><h3>Source metric history</h3><p>Persisted metric snapshots linked to this signal, compared with the detector baseline.</p></div><span className="signal-chart-unit">{selected.anomaly.metric.endsWith("_minor") ? "GBP" : selected.anomaly.metric.includes("rate") || selected.anomaly.metric === "ctr" ? "%" : "count"}</span></div>{detail ? <SignalChart signal={detail.anomaly} snapshots={detail.snapshots} /> : <div className="signal-chart-loading">Loading linked metric snapshots…</div>}</article>
          <section className="signal-explanation" aria-label="Signal explanation">
            <div className="signal-content-heading"><h3>What changed</h3><span>Observed, not diagnosed</span></div>
            <p>{selected.finding?.label ?? signalMetricLabel(selected.anomaly.metric)} {directionText} by <strong>{Math.abs(selected.anomaly.changePercent).toFixed(1)}%</strong> in the detected window. The observed value was <strong>{formatSignalValue(selected.anomaly.metric, selected.anomaly.actualValue)}</strong>, compared with a baseline of <strong>{formatSignalValue(selected.anomaly.metric, selected.anomaly.baselineValue)}</strong>.</p>
            <p className="signal-reading-note">This comparison confirms a measured change for the selected run. By itself, it does not identify what caused the change.</p>
          </section>
          <section className="signal-sources" aria-label="Signal source records">
            <div className="signal-content-heading"><div><h3>Source records</h3><p>Metric snapshots used to plot and evaluate this signal.</p></div><span>{detail ? `${detail.snapshots.length} snapshots` : "Loading…"}</span></div>
            {detail?.snapshots.length ? <div className="signal-snapshot-list">{detail.snapshots.map((snapshot) => {
              const currentWindow = snapshot.window.startAt >= detail.anomaly.currentWindow.startAt;
              return <div className="signal-snapshot-row" key={snapshot.snapshotId}><span className={`signal-source-kind ${currentWindow ? "current" : "baseline"}`}>{currentWindow ? "Observed" : "Reference"}</span><time>{virtualDate(snapshot.window.startAt)}</time><strong>{formatSignalValue(detail.anomaly.metric, signalValue(detail.anomaly.metric, snapshot), snapshot.currency)}</strong><details><summary>Record ID</summary><code>{snapshot.snapshotId}</code></details></div>;
            })}</div> : <div className="signal-sources-empty">No linked metric snapshot records were returned for this signal.</div>}
            {sourceEvents.length ? <details className="signal-source-events"><summary>Underlying business event records · {sourceEvents.length}</summary><ul>{sourceEvents.map((source, index) => <li key={source.recordId}><a href={`/api/dev/simulator/events?${q({ simulationRunId: detail?.simulationRunId, eventId: source.recordId })}`} target="_blank" rel="noreferrer" title={source.recordId}>Open linked event {index + 1} ↗</a></li>)}</ul></details> : null}
          </section>
          <section className="investigator-placeholder" aria-label="Planned Investigator explanation module"><div className="signal-content-heading"><h3>Investigator explanation</h3><span>Planned module</span></div><p>This space will present evidence-backed explanations, supporting and contradicting sources, and direct links to the records. The Investigator is not connected yet, so this signal has no generated diagnosis.</p><details><summary>Detector reference details</summary><p>{detail?.finding?.evaluation.baseline ? `The detector compared this window with ${detail.finding.evaluation.baseline.n} historical samples using its ${detail.finding.evaluation.baseline.estimator.replaceAll("_", " ")} reference.` : "The detector reference details are not available for this record."}</p><p>{detail?.finding?.evidence.baselineDerivation ?? "No further baseline calculation details are available."}</p></details></section>
        </>}
      </section>
    </div>
  </div>;
}

interface OutcomeSnapshot { window: { startAt: string; endAt: string }; counters: { revenueMinor: number; orders: number; sessions: number; adSpendMinor: number; delayedShipments: number; shipments: number; reviews: number; lowRatingReviews: number }; rates: { conversionRate: number | null; lateDeliveryRate: number | null; lowRatingRate: number | null } }
interface OutcomeData { total: OutcomeSnapshot | null; daily: OutcomeSnapshot[] }

export function OutcomesPage() {
  const { runId, loaded, data, error } = useScopedResource<OutcomeData>((id) => `/api/metrics/breakdown?${q({ simulationRunId: id, days: 30 })}`);
  if (!data) return <div className="section-page"><ResourceState loaded={loaded} runId={runId} error={error} /></div>;
  const total = data.total;
  const max = Math.max(1, ...data.daily.map((item) => item.counters.revenueMinor));
  return <div className="section-page" data-testid="outcomes-page">
    <p className="section-intro">Revenue, demand, advertising, delivery, and review outcomes computed from persisted records in this run.</p>
    <div className="section-stats"><Stat label="Revenue" value={total ? money(total.counters.revenueMinor) : "—"} /><Stat label="Orders" value={total ? num(total.counters.orders) : "—"} /><Stat label="Ad spend" value={total ? money(total.counters.adSpendMinor) : "—"} /><Stat label="Sessions" value={total ? num(total.counters.sessions) : "—"} /></div>
    <div className="outcomes-detail-grid">
      <article className="card section-card"><div className="section-card-head"><h2>Daily revenue</h2><span className="muted small">30 virtual days</span></div>{data.daily.length ? <div className="outcome-bars">{data.daily.map((item) => <div className="outcome-bar" key={item.window.startAt} title={`${virtualDate(item.window.startAt)} · ${money(item.counters.revenueMinor)}`}><span style={{ height: `${Math.max(2, item.counters.revenueMinor / max * 100)}%` }} /><small>{new Date(item.window.startAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</small></div>)}</div> : <div className="section-empty">No daily metric snapshots are available for this run.</div>}</article>
      <article className="card section-card"><div className="section-card-head"><h2>Operating rates</h2></div><dl className="outcome-rates"><div><dt>Conversion</dt><dd>{total ? pct(total.rates.conversionRate, 2) : "—"}</dd></div><div><dt>Late deliveries</dt><dd>{total ? pct(total.rates.lateDeliveryRate) : "—"}</dd></div><div><dt>Low ratings</dt><dd>{total ? pct(total.rates.lowRatingRate) : "—"}</dd></div><div><dt>Reviews</dt><dd>{total ? num(total.counters.reviews) : "—"}</dd></div><div><dt>Low rating reviews</dt><dd>{total ? num(total.counters.lowRatingReviews) : "—"}</dd></div><div><dt>Shipments delayed</dt><dd>{total ? `${num(total.counters.delayedShipments)} / ${num(total.counters.shipments)}` : "—"}</dd></div></dl></article>
    </div>
  </div>;
}

interface MonitoringData { monitor: MonitorStatus; capabilities: Capabilities }

export function MonitoringPage() {
  const { runId, loaded, withRun } = useRun();
  const [resource, setResource] = useState<{ runId: string; data: MonitoringData | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    const query = q({ simulationRunId: runId });
    void Promise.all([api<MonitorStatus>(`/api/dev/monitor/run?${query}`), api<Capabilities>(`/api/intelligence/capabilities?${query}`)])
      .then(([monitor, capabilities]) => { if (!cancelled) setResource({ runId, data: { monitor, capabilities }, error: null }); })
      .catch((error: unknown) => { if (!cancelled) setResource({ runId, data: null, error: error instanceof Error ? error.message : "Request failed" }); });
    return () => { cancelled = true; };
  }, [runId]);
  const current = resource?.runId === runId ? resource : null;
  const data = current?.data ?? null;
  if (!data) return <div className="section-page"><ResourceState loaded={loaded} runId={runId} error={current?.error ?? null} /></div>;
  const observe = data.capabilities.stages.find((stage) => stage.id === "observe");
  const monitor = data.monitor;
  return <div className="section-page" data-testid="monitoring-page">
    <p className="section-intro">Scheduled monitor status and worker health for the currently selected simulation.</p>
    <div className="section-stats"><Stat label="Last scan" value={monitor.lastAsOf ? virtualDate(monitor.lastAsOf) : "Not recorded"} /><Stat label="Direct trigger" value={monitor.methodA?.enabled ? "Enabled" : "Disabled"} /><Stat label="Change stream" value={monitor.worker?.connected ? "Connected" : "Not confirmed"} /><Stat label="Persisted snapshots" value={num(Number(observe?.metrics.snapshots ?? 0))} /></div>
    <article className="card section-card"><div className="section-card-head"><h2>Worker and scan health</h2></div><dl className="outcome-rates"><div><dt>Worker heartbeat</dt><dd>{monitor.worker?.lastHeartbeatAt ? virtualDate(monitor.worker.lastHeartbeatAt) : "No heartbeat recorded"}</dd></div><div><dt>Jobs pending</dt><dd>{monitor.jobs?.pending ?? 0}</dd></div><div><dt>Jobs running</dt><dd>{monitor.jobs?.running ?? 0}</dd></div><div><dt>Jobs completed</dt><dd>{monitor.jobs?.completed ?? 0}</dd></div><div><dt>Jobs failed</dt><dd>{monitor.jobs?.failed ?? 0}</dd></div><div><dt>Events observed</dt><dd>{num(Number(observe?.metrics.events ?? 0))}</dd></div></dl>
      {monitor.failedJobs?.length ? <div className="monitor-failures">{monitor.failedJobs.map((job) => <p key={job.jobKey}>Attempt {job.attempts} · {job.jobKey}: {job.lastError}</p>)}</div> : null}
      <div className="section-links"><Link className="btn primary" href={withRun("/dev/monitor")}>Open anomaly monitor</Link><Link className="btn" href={withRun("/dashboard/architecture")}>View pipeline readiness</Link></div>
    </article>
  </div>;
}

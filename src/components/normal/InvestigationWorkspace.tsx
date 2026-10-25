"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { virtualDate } from "@/lib/format";
import { api, q, sevClass, type Bundle, type CollectionSummary, type EvidenceList, type Trace } from "./api";
import { useRun } from "./run-context";
import { CapabilityPlaceholder } from "./CapabilityPlaceholder";
import { EvidenceExplorer } from "./EvidenceExplorer";
import { AIInvestigation } from "./AIInvestigation";
import { EvidenceToolTrace } from "./EvidenceToolTrace";
import { PageSkeleton } from "./PageSkeleton";
import type { ExternalSourceT, ReportT } from "@/intelligence/investigator/schemas";
import { SolutionPlanning } from "./SolutionPlanning";

interface Data { bundle: Bundle; evidence: EvidenceList; trace: Trace }

export function InvestigationWorkspace() {
  const investigationId = decodeURIComponent(useParams<{ id: string }>().id);
  const { runId, loaded, withRun } = useRun();
  const [result, setResult] = useState<{ runId: string | null; data: Data | null; notFound: boolean; error: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastRun, setLastRun] = useState<{ runId: string | null; summary: CollectionSummary } | null>(null);
  const [research, setResearch] = useState<{ runId: string | null; sources: ExternalSourceT[]; report: ReportT | null } | null>(null);
  const selected = useRef<string | null>(null);
  const requestSequence = useRef(0);

  const load = useCallback(async (run: string | null) => {
    const key = run;
    const sequence = ++requestSequence.current;
    try {
      const scope = q({ simulationRunId: run });
      const [bundle, evidence, trace] = await Promise.all([
        api<Bundle>(`/api/investigations/${encodeURIComponent(investigationId)}?${scope}`),
        api<EvidenceList>(`/api/investigations/${encodeURIComponent(investigationId)}/evidence?${scope}&limit=100`),
        api<Trace>(`/api/investigations/${encodeURIComponent(investigationId)}/evidence-trace?${scope}`),
      ]);
      if (selected.current !== key || requestSequence.current !== sequence) return;
      setResult({ runId: key, data: { bundle, evidence, trace }, notFound: false, error: null });
    } catch (e) {
      if (selected.current !== key || requestSequence.current !== sequence) return;
      setResult({ runId: key, data: null, notFound: (e as { status?: number }).status === 404, error: (e as { status?: number }).status === 404 ? null : (e as Error).message });
    }
  }, [investigationId]);
  useLayoutEffect(() => { selected.current = runId; requestSequence.current++; }, [runId]);
  useEffect(() => { if (!loaded) return; void (async () => { await load(runId); })(); }, [runId, loaded, load]);

  const collect = async (mode: "initial" | "refresh") => {
    setBusy(true); setError(null);
    try {
      const summary = await api<CollectionSummary>(`/api/dev/investigations/${encodeURIComponent(investigationId)}/collect-evidence`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...(runId ? { simulationRunId: runId } : {}), collectionMode: mode }) });
      setLastRun({ runId, summary }); await load(runId);
    } catch (e) {
      setError((e as { code?: string }).code === "evidence_collection_in_progress" ? "Evidence collection is already running for this investigation; it will appear when finished." : (e as Error).message);
    } finally { setBusy(false); }
  };

  if (!loaded) return <PageSkeleton variant="workspace" label="Loading investigation workspace" />;
  const current = result && result.runId === runId ? result : null;
  const data = current?.data ?? null, notFound = current?.notFound ?? false, last = lastRun && lastRun.runId === runId ? lastRun.summary : null;
  if (notFound) return <div className="empty" data-testid="investigation-not-found">Investigation <code>{investigationId}</code> does not exist in run <code>{runId}</code>. Evidence is scoped to one business and simulation run; pick the run it belongs to. <Link href={withRun("/dashboard")}>Back to overview</Link>.</div>;
  if (current?.error && !data) return <div className="alert error" data-testid="investigation-error">{current.error}</div>;
  if (!data) return <PageSkeleton variant="workspace" label="Loading investigation workspace" />;
  const { bundle, evidence, trace } = data;
  const inv = bundle.investigation, inc = bundle.incident, latest = evidence.latestCollection;
  return (
    <>
      <div className="card" data-testid="incident-overview">
        <div className="card-head"><h3>{inv.title}</h3><div className="row">{inc ? <span className={`pill ${sevClass(inc.severity.level)}`}>{inc.severity.level} · {inc.severity.score}</span> : null}<span className="pill" data-testid="investigation-status">{inv.status.replaceAll("_", " ")}</span></div></div>
        <div className="card-body" style={{ display: "grid", gap: 6 }}>
          <span className="small"><strong>Nike — Unaffiliated Simulation</strong> · <code>{inv.investigationId}</code> · business <code>{inv.businessId}</code> · run <code>{bundle.simulationRunId}</code> · opened {virtualDate(inv.startedAt)} · updated {virtualDate(inv.updatedAt)}</span>
          <span className="small">Window: {bundle.timeWindows.incident.startAt ? `${virtualDate(bundle.timeWindows.incident.startAt)} → ${bundle.timeWindows.incident.endAt ? virtualDate(bundle.timeWindows.incident.endAt) : "ongoing"}` : "—"}</span>
          <span className="small">Affected: {[...bundle.affected.campaigns, ...bundle.affected.products, ...bundle.affected.channels].join(", ") || "whole business"} · Metrics: {bundle.anomalies.map((anomaly) => anomaly.metric.replaceAll("_", " ")).join(", ") || "pending"} · Evidence: {evidence.total}</span>
          {inc ? <span className="muted small">{inc.summary}</span> : null}
          <div className="scroll-x"><table data-testid="related-anomalies"><thead><tr><th>Anomaly</th><th>Direction</th><th className="num">Actual</th><th className="num">Baseline</th><th className="num">Change</th><th>Severity</th><th>Window</th></tr></thead>
            <tbody>{bundle.anomalies.map((a) => <tr key={a.anomalyId}><td><code>{a.metric}</code></td><td>{a.direction}</td><td className="num">{a.actualValue.toFixed(4)}</td><td className="num">{a.baselineValue.toFixed(4)}</td><td className="num">{a.changePercent > 0 ? "+" : ""}{a.changePercent.toFixed(1)}%</td><td><span className={`pill ${sevClass(a.severity)}`}>{a.severity}</span></td><td className="small">{virtualDate(a.currentWindow.startAt)} → {virtualDate(a.currentWindow.endAt)}</td></tr>)}</tbody></table></div>
          <span className="muted small">{bundle.note}</span>
        </div>
      </div>

      <AIInvestigation key={`${bundle.simulationRunId}:${inv.investigationId}`} investigationId={inv.investigationId} businessId={inv.businessId} simulationRunId={bundle.simulationRunId} evidenceItems={evidence.items} onComplete={() => void load(runId)} onResearchUpdate={(sources, report) => { if (selected.current === runId) setResearch({ runId, sources, report }); }} />

      <div className="card" data-testid="evidence-panel">
        <div className="card-head"><h3>Evidence retrieval</h3>
          <div className="row">
            <button className="btn primary" onClick={() => collect("initial")} disabled={busy} data-testid="collect-evidence">{busy ? <><span className="spinner" /> Collecting…</> : "Collect evidence"}</button>
            <button className="btn" onClick={() => collect("refresh")} disabled={busy || !latest} title="Re-run every tool at the current data cutoff; identical retrievals are overwritten, never duplicated" data-testid="refresh-evidence">Refresh</button>
          </div>
        </div>
        <div className="card-body" style={{ display: "grid", gap: 6 }}>
          {error ? <div className="alert error" data-testid="collect-error">{error}</div> : null}
          {latest ? (
            <>
              <span className="small" data-testid="collection-summary">Status <strong>{latest.status}</strong> · cutoff {latest.cutoff} · {latest.selectedTools.length} tools selected · {latest.completedTools.length} completed · {latest.emptyTools.length} empty · {latest.failedTools.length} failed · {evidence.total} evidence records · last collection {latest.completedAt ? new Date(latest.completedAt).toLocaleString("en-GB") : "running"}{latest.attempt > 1 ? ` · attempt ${latest.attempt}` : ""}</span>
              <div className="row" style={{ flexWrap: "wrap" }} data-testid="selected-tools">{latest.selectedTools.map((t) => <span key={t.tool} className={`pill ${latest.completedTools.includes(t.tool) ? "ok" : latest.failedTools.includes(t.tool) ? "danger" : latest.emptyTools.includes(t.tool) ? "" : "warn"}`} title={t.reason}>{t.tool} · {t.role.replaceAll("_", " ")}</span>)}</div>
              {last ? <span className="muted small" data-testid="collect-result">{last.reused ? "Returned the existing collection for this data cutoff (nothing re-run)." : `Ran ${last.outcomes.length} tools in ${last.outcomes.reduce((a, o) => a + o.durationMs, 0)} ms; ${last.evidenceIds.length} evidence records.`}</span> : null}
            </>
          ) : <span className="muted small">No evidence collected yet for this investigation. Collection selects tools deterministically from the observed anomalies (no scenario labels) and stores canonical Evidence with resolvable source references.</span>}
        </div>
      </div>

      <EvidenceExplorer items={evidence.items} total={evidence.total} simulationRunId={bundle.simulationRunId} externalSources={research?.runId === runId ? research.sources : []} report={research?.runId === runId ? research.report : null} />
      <EvidenceToolTrace collections={trace.collections} runs={trace.toolRuns} />
      <SolutionPlanning key={`planning:${bundle.simulationRunId}:${inv.investigationId}`} investigationId={inv.investigationId} businessId={inv.businessId} simulationRunId={bundle.simulationRunId} evidenceItems={evidence.items} />
      <section className="card" data-testid="execution-intake"><div className="card-head"><h3>Agent execution</h3></div><div className="card-body"><p>Submit a proposed plan, review the exact version and approve its actions before execution. Decisions, agent missions and adapter receipts are persisted for this run.</p><a className="btn primary" href={`/dashboard/approvals?run=${encodeURIComponent(bundle.simulationRunId)}`}>Open Approvals</a><a className="btn" href={`/dashboard/activity?run=${encodeURIComponent(bundle.simulationRunId)}`}>Execution activity</a></div></section>
      <CapabilityPlaceholder title="Outcome verification" status="Not implemented" testId="placeholder-verification"
        description="Will compare metrics before and after executed actions against each success criterion and record verified outcomes. No outcome figures are shown until measured."
        inputs={["ActionExecution", "metric_snapshots before and after"]} outputs={["ActionOutcome", "Mubit adaptation evaluation"]} contracts={["ActionOutcome", "EvaluationResult"]} />
    </>
  );
}

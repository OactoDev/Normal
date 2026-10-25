"use client";

import { useCallback, useEffect, useState } from "react";
import { api, q, type DiagnosisResult } from "./api";

const strengthClass = (s: string) => (s === "strong" ? "ok" : s === "moderate" ? "accent" : "");
const label = (cause: string) => cause.replaceAll("_", " ");

/** Runs and shows the Mubit investigator for one investigation. Everything shown comes from the persisted Diagnosis. */
export function InvestigatorPanel({ investigationId, runId, evidenceCount, evidenceTitles, onDiagnosed }: {
  investigationId: string; runId: string | null; evidenceCount: number; evidenceTitles: Record<string, string>; onDiagnosed: () => void;
}) {
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; mubitRequestId?: string } | null>(null);
  const id = encodeURIComponent(investigationId);

  const load = useCallback(async () => {
    try { setResult(await api<DiagnosisResult>(`/api/investigations/${id}/diagnosis?${q({ simulationRunId: runId })}`)); } catch { setResult({ diagnosis: null, modelCall: null }); }
  }, [id, runId]);
  useEffect(() => { void (async () => { await load(); })(); }, [load]);

  const run = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/dev/investigations/${id}/diagnose`, { method: "POST", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(runId ? { simulationRunId: runId } : {}) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError({ message: body?.error?.message ?? `Diagnosis failed (${res.status})`, mubitRequestId: body?.error?.mubitRequestId }); return; }
      setResult(body as DiagnosisResult); onDiagnosed();
    } catch { setError({ message: "The diagnosis request did not reach the server. Please retry." }); } finally { setBusy(false); }
  };

  const d = result?.diagnosis ?? null, call = result?.modelCall ?? null;
  const refs = (ids: string[]) => (ids.length ? ids.map((eid, i) => <span key={eid}>{i ? ", " : ""}<span title={eid}>{evidenceTitles[eid] ?? eid}</span></span>) : "—");
  return (
    <div className="card" data-testid="investigator-panel">
      <div className="card-head"><h3>Mubit investigator</h3>
        <div className="row">
          {d ? <span className={`pill ${d.requiresReview ? "warn" : "ok"}`} data-testid="diagnosis-review">{d.requiresReview ? "needs review" : "supported"}</span> : null}
          <button className="btn primary" onClick={run} disabled={busy || evidenceCount === 0} title={evidenceCount === 0 ? "Collect evidence first" : "Send this investigation's anomalies and evidence to Gemini 4 Argon through Mubit"} data-testid="run-diagnosis">
            {busy ? <><span className="spinner" /> Diagnosing through Mubit…</> : d ? "Re-run diagnosis" : "Run Mubit diagnosis"}
          </button>
        </div>
      </div>
      <div className="card-body" style={{ display: "grid", gap: 8 }}>
        {error ? <div className="alert error" data-testid="diagnosis-error">{error.message}{error.mubitRequestId ? <> · Mubit request <code>{error.mubitRequestId}</code></> : null}</div> : null}
        {!d ? <span className="muted small">{evidenceCount === 0 ? "Collect evidence first. The investigator reads only this investigation's anomalies and evidence records." : "No diagnosis yet. The investigator sends the anomalies and evidence above to Gemini 4 Argon through Mubit and saves the answer only if it cites evidence that exists."}</span> : (
          <>
            <div data-testid="diagnosis-result"><span className="muted small">Most likely cause</span><h3 style={{ margin: "2px 0 4px", textTransform: "capitalize" }} data-testid="diagnosis-primary">{label(d.primaryCause)}</h3><span className="small">{d.summary}</span></div>
            <div className="scroll-x"><table data-testid="diagnosis-hypotheses"><thead><tr><th>Hypothesis</th><th>Strength</th><th>Supporting evidence</th><th>Contradicting evidence</th><th>Why</th></tr></thead>
              <tbody>{d.hypotheses.map((h, i) => <tr key={`${h.cause}-${i}`}><td style={{ textTransform: "capitalize" }}>{label(h.cause)}</td><td><span className={`pill ${strengthClass(h.strength)}`}>{h.strength}</span></td>
                <td className="small">{refs(h.evidenceIds)}</td><td className="small">{refs(h.counterEvidenceIds)}</td><td className="small">{h.explanation}</td></tr>)}</tbody></table></div>
            {d.missingEvidence.length ? <div className="small"><span className="muted">Missing evidence</span><ul style={{ margin: "4px 0 0 16px" }}>{d.missingEvidence.map((m) => <li key={m}>{m}</li>)}</ul></div> : null}
            {call ? <span className="muted small" data-testid="diagnosis-trace">Diagnosed by <code>{call.providerModel}</code> ({call.modelKind}) through Mubit · request <code data-testid="mubit-request-id">{call.mubitRequestId}</code> · task <code>{call.instructionsFingerprint}</code> · {call.inputEvidenceIds.length} evidence records{call.latencyMs !== undefined ? ` · ${(call.latencyMs / 1000).toFixed(1)} s` : ""} · {new Date(d.createdAt).toLocaleString("en-GB")}</span> : null}
          </>
        )}
      </div>
    </div>
  );
}

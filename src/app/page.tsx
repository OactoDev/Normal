"use client";
import React, { useEffect, useState } from "react";
import type { PlanHandoffT } from "../contracts";
import { PlanReview } from "../components/plan-review";
import { AgentMissionControl } from "../components/agent-mission-control";
import { ExecutionResults } from "../components/execution-results";
import { IntelligencePanel } from "../components/intelligence-panel";
import { usePlanExecutions } from "../hooks/use-plan-executions";

export default function NormalOperationsCockpit() {
  const [tab, setTab] = useState("review"), [planId,setPlanId] = useState("plan_001");
  const [handoff,setHandoff] = useState<PlanHandoffT | null>(null), [principal,setPrincipal] = useState("merchant_owner_01");
  const [error,setError] = useState(""), [busy,setBusy] = useState(false);
  const { data, error: pollError, refresh } = usePlanExecutions(planId);
  const headers = { "Content-Type": "application/json", "x-normal-principal": principal };
  async function load(id: string) {
    const r = await fetch(`/api/plans/${encodeURIComponent(id)}`, { cache: "no-store" });
    const b = await r.json(); if (!r.ok) throw new Error(b.error?.message); setHandoff(b);
  }
  useEffect(() => { setHandoff(null); void load(planId).catch(e => setError(String(e))); },[planId]);
  async function post(path: string, body: unknown) {
    const r = await fetch(path,{method:"POST",headers,body:JSON.stringify(body)}), b = await r.json();
    if (!r.ok) throw new Error(`${b.error?.code}: ${b.error?.message}`); return b;
  }
  async function approve(ids: string[], decision: "approved" | "partially_approved" | "rejected", note?: string) {
    setBusy(true); setError("");
    try {
      await post(`/api/plans/${planId}/approve`,{planVersion:handoff.plan.planVersion,decision,approvedActionIds:ids,...(note ? {changeRequestNote:note} : {})});
      await refresh(); await load(planId); if (decision !== "rejected") setTab("control");
    } catch(e) { setError(String(e)); } finally { setBusy(false); }
  }
  async function execute(actionIds?: string[]) {
    setBusy(true); setError("");
    try { await post(`/api/plans/${planId}/execute`,{approvalId:data?.approval?.approvalId,...(actionIds ? {actionIds} : {})}); await refresh(); setTab("control"); }
    catch(e) { setError(String(e)); } finally { setBusy(false); }
  }
  async function reset() {
    setBusy(true); setError("");
    try { await post("/api/sim/reset",{planId}); await load(planId); await refresh(); setTab("review"); }
    catch(e) { setError(String(e)); } finally { setBusy(false); }
  }
  return <div className="min-h-screen bg-slate-950 text-slate-100">
    <header className="border-b border-slate-800 p-5 flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-xl font-bold text-sky-400">Normal</h1><p className="text-xs text-slate-400">Permission-controlled operations · Nike business simulation</p></div>
      <nav className="flex flex-wrap gap-3">{["intelligence","review","control","results"].map(t => <button key={t} onClick={()=>setTab(t)} className={tab===t ? "text-sky-400 font-bold" : "text-slate-400"}>{t === "control" ? "Mission Control" : t[0].toUpperCase()+t.slice(1)}</button>)}</nav>
      <label className="text-xs">Demo principal <select aria-label="Principal" className="bg-slate-800 p-2 rounded" value={principal} onChange={e=>setPrincipal(e.target.value)}><option value="merchant_owner_01">Merchant owner</option><option value="ops_viewer">Ops viewer (read-only)</option></select></label>
      <a href="/ads" className="text-sky-400">Ads Manager ↗</a><a href="/store" className="text-sky-400">Store ↗</a>
    </header>
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      <p className="text-xs text-slate-400">{planId} · {data?.planStatus || handoff?.plan.status} {data?.needsAttention && "· Needs attention"}</p>
      {(error || pollError) && <div role="alert" className="border border-red-500 rounded p-4 text-red-300">{error || pollError}</div>}
      {tab === "intelligence" && <IntelligencePanel onPlanGenerated={async id=>{setPlanId(id);setTab("review");}} />}
      {tab === "review" && (handoff ? <PlanReview key={`${planId}:${handoff.plan.planVersion}`} handoff={handoff} approval={data?.approval && data.approval.planVersion === handoff.plan.planVersion ? data.approval : null} onApprove={approve} isApproving={busy} /> : <p>Loading plan…</p>)}
      {tab === "control" && <AgentMissionControl data={data} busy={busy} onExecute={execute} onReset={reset} />}
      {tab === "results" && <ExecutionResults data={data} />}
    </main>
    <footer className="p-6 text-center text-xs text-slate-500">Ads and storefront are simulated. Email goes only to the configured test inbox. Demo header identities are not production authentication.</footer>
  </div>;
}

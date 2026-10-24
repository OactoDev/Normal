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
  const tabs: [string, string][] = [["intelligence","Intelligence"],["review","Review"],["control","Mission Control"],["results","Results"]];
  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-8">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="h-7 w-7 rounded-md bg-slate-900 text-white grid place-items-center text-sm font-semibold">N</div>
          <span className="font-semibold tracking-tight">Normal</span>
        </div>
        <nav className="flex h-full items-stretch gap-6 text-sm">{tabs.map(([t,label]) => <button key={t} onClick={()=>setTab(t)} className={`border-b-2 -mb-px ${tab===t ? "border-slate-900 text-slate-900 font-medium" : "border-transparent text-slate-500 hover:text-slate-900"}`}>{label}</button>)}</nav>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <a href="/ads" className="text-slate-500 hover:text-slate-900">Ads Manager</a>
          <a href="/store" className="text-slate-500 hover:text-slate-900">Store</a>
          <select aria-label="Principal" className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700" value={principal} onChange={e=>setPrincipal(e.target.value)}><option value="merchant_owner_01">Merchant owner</option><option value="ops_viewer">Ops viewer (read-only)</option></select>
        </div>
      </div>
    </header>
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <p className="text-xs text-slate-500">Nike store simulation · {planId} · {data?.planStatus || handoff?.plan.status} {data?.needsAttention && "· Needs attention"}</p>
      {(error || pollError) && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error || pollError}</div>}
      {tab === "intelligence" && <IntelligencePanel onPlanGenerated={async id=>{setPlanId(id);setTab("review");}} />}
      {tab === "review" && (handoff ? <PlanReview key={`${planId}:${handoff.plan.planVersion}`} handoff={handoff} approval={data?.approval && data.approval.planVersion === handoff.plan.planVersion ? data.approval : null} onApprove={approve} isApproving={busy} /> : <p>Loading plan…</p>)}
      {tab === "control" && <AgentMissionControl data={data} busy={busy} onExecute={execute} onReset={reset} />}
      {tab === "results" && <ExecutionResults data={data} />}
    </main>
    <footer className="p-6 text-center text-xs text-slate-500">{process.env.NEXT_PUBLIC_PUBLIC_DEMO === "1" ? "Public demo · Ads, storefront changes and email are simulated. Your browser has its own demo session." : "Ads and storefront are simulated. Email goes only to the configured test inbox. Demo header identities are not production authentication."}</footer>
  </div>;
}

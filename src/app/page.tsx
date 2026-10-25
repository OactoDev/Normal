"use client";
import React, { useEffect, useRef, useState } from "react";
import type { PlanHandoffT, PlanApprovalT } from "../contracts";
import { PlanReview } from "../components/plan-review";
import { AgentMissionControl } from "../components/agent-mission-control";
import { ExecutionResults } from "../components/execution-results";
import { IntelligencePanel } from "../components/intelligence-panel";
import { usePlanExecutions, type ExecutionSnapshot } from "../hooks/use-plan-executions";

const isActive = (s: ExecutionSnapshot | null) => !!s?.executions.some(e => e.status === "queued" || e.status === "running");

export default function NormalOperationsCockpit() {
  const [tab, setTab] = useState("intelligence"), [planId,setPlanId] = useState("plan_001");
  // Which Mubit call wrote each AI plan, so Review can attribute it.
  const [plannerCalls, setPlannerCalls] = useState<Record<string, any>>({});
  const [handoff,setHandoff] = useState<PlanHandoffT | null>(null), [principal,setPrincipal] = useState("merchant_owner_01");
  const [error,setError] = useState(""), [busy,setBusy] = useState(false);
  const { data, error: pollError, refresh } = usePlanExecutions(planId);
  // Set when this browser dispatched a run; Results opens once that run has no queued or running work left.
  const watching = useRef<{ seenActive: boolean } | null>(null);
  const headers = { "Content-Type": "application/json", "x-normal-principal": principal };
  async function load(id: string) {
    const r = await fetch(`/api/plans/${encodeURIComponent(id)}`, { cache: "no-store" });
    const b = await r.json(); if (!r.ok) throw new Error(b.error?.message); setHandoff(b);
  }
  useEffect(() => { setHandoff(null); void load(planId).catch(e => setError(String(e))); },[planId]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [tab]);
  useEffect(() => {
    const w = watching.current;
    if (!w || !data) return;
    if (isActive(data)) { w.seenActive = true; return; }
    if (!w.seenActive) return;
    watching.current = null;
    // A short hold lets the presenter see every agent turn green before the verified results open. Not cleared on
    // the next poll (that would always cancel it); the tab check leaves a presenter who navigated away alone.
    setTimeout(() => setTab(current => current === "control" ? "results" : current), 1500);
  }, [data]);
  async function post(path: string, body: unknown) {
    const r = await fetch(path,{method:"POST",headers,body:JSON.stringify(body)}), b = await r.json();
    if (!r.ok) throw new Error(`${b.error?.code}: ${b.error?.message}`); return b;
  }
  async function dispatch(approvalId: string, actionIds?: string[]) {
    const started: ExecutionSnapshot = await post(`/api/plans/${planId}/execute`,{approvalId,...(actionIds ? {actionIds} : {})});
    watching.current = { seenActive: isActive(started) };
    await refresh(); await load(planId);
    setTab(isActive(started) ? "control" : "results");
  }
  async function approve(ids: string[], decision: "approved" | "partially_approved" | "rejected", note?: string) {
    setBusy(true); setError("");
    try {
      const { approval }: { approval: PlanApprovalT } = await post(`/api/plans/${planId}/approve`,{planVersion:handoff.plan.planVersion,decision,approvedActionIds:ids,...(note ? {changeRequestNote:note} : {})});
      // Approval is the merchant's go-ahead, so the approved agents are dispatched straight away.
      if (decision !== "rejected") await dispatch(approval.approvalId);
      else { await refresh(); await load(planId); }
    } catch(e) { setError(String(e)); await refresh().catch(() => {}); } finally { setBusy(false); }
  }
  async function execute(actionIds?: string[]) {
    setBusy(true); setError("");
    try { await dispatch(data?.approval?.approvalId, actionIds); }
    catch(e) { setError(String(e)); } finally { setBusy(false); }
  }
  async function reset() {
    setBusy(true); setError("");
    try { watching.current = null; await post("/api/sim/reset",{planId}); await load(planId); await refresh(); setTab("review"); }
    catch(e) { setError(String(e)); } finally { setBusy(false); }
  }
  const tabs: [string, string][] = [["intelligence","Intelligence"],["review","Review"],["control","Mission Control"],["results","Results"]];
  const changesRequested = data?.approval?.decision === "rejected" && data.changeRequestNote && data.approval.planVersion === handoff?.plan.planVersion;
  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-8">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="h-7 w-7 rounded-md bg-slate-900 text-white grid place-items-center text-sm font-semibold">N</div>
          <span className="font-semibold tracking-tight">Normal</span>
        </div>
        <nav className="flex h-full items-stretch gap-6 text-sm">{tabs.map(([t,label]) => <button key={t} onClick={()=>setTab(t)} className={`border-b-2 -mb-px flex items-center gap-2 ${tab===t ? "border-slate-900 text-slate-900 font-medium" : "border-transparent text-slate-500 hover:text-slate-900"}`}>{label}{t === "control" && isActive(data) && <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" aria-label="Agents running" />}</button>)}</nav>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <a href="/shopify" className="text-slate-500 hover:text-slate-900 font-medium">Shopify Admin</a>
          <a href="/ads" className="text-slate-500 hover:text-slate-900 font-medium">Ads Manager</a>
          <a href="/store?ops=1" className="text-slate-500 hover:text-slate-900 font-medium">Storefront</a>
          <select aria-label="Principal" className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700" value={principal} onChange={e=>setPrincipal(e.target.value)}><option value="merchant_owner_01">Merchant owner</option><option value="ops_viewer">Ops viewer (read-only)</option></select>
        </div>
      </div>
    </header>
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <p className="text-xs text-slate-500">Nike store simulation · {planId} · {data?.planStatus || handoff?.plan.status} {data?.needsAttention && "· Needs attention"}</p>
      {(error || pollError) && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error || pollError}</div>}
      {changesRequested && (tab === "review" || tab === "control") && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-medium">Sent back for changes by {data.approval.reviewingPrincipal} · v{data.approval.planVersion}</p><p className="mt-1">“{data.changeRequestNote}”</p><p className="mt-1 text-xs text-amber-700">Nothing in this version will run. An edited plan needs a new version.</p></div>}
      {tab === "intelligence" && <IntelligencePanel onPlanGenerated={async (id, plannerCall)=>{setPlannerCalls(calls=>({...calls,[id]:plannerCall}));setPlanId(id);setTab("review");}} />}
      {tab === "review" && (handoff ? <PlanReview key={`${planId}:${handoff.plan.planVersion}`} handoff={handoff} plannerCall={plannerCalls[planId]} snapshot={data} approval={data?.approval && data.approval.planVersion === handoff.plan.planVersion ? data.approval : null} onApprove={approve} isApproving={busy} /> : <p>Loading plan…</p>)}
      {tab === "control" && <AgentMissionControl handoff={handoff} data={data} busy={busy} onExecute={execute} onReset={reset} onReview={()=>setTab("review")} />}
      {tab === "results" && <ExecutionResults handoff={handoff} data={data} />}
    </main>
    <footer className="p-6 text-center text-xs text-slate-500">{process.env.NEXT_PUBLIC_PUBLIC_DEMO === "1" ? "Public demo · Ads, storefront changes and email are simulated. Your browser has its own demo session." : "Ads and storefront are simulated. Email goes only to the configured test inbox. Demo header identities are not production authentication."}</footer>
  </div>;
}

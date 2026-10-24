"use client";
import { useEffect, useState } from "react";
import type { PlanHandoffT, PlanApprovalT } from "../contracts";
import { PlanFlowchart } from "./plan-flowchart";
export function PlanReview({ handoff, approval, onApprove, isApproving }: { handoff: PlanHandoffT; approval: PlanApprovalT | null; onApprove: (ids:string[],decision:"approved"|"partially_approved"|"rejected",note?:string)=>Promise<void>; isApproving:boolean }) {
  const {plan,diagnosis,evidence} = handoff, all = plan.actions.map(a=>a.actionId);
  const [selected,setSelected] = useState(all), [note,setNote] = useState(""), [budgets,setBudgets] = useState<Record<string, number>>({});
  // Current budgets come from the simulated ad platform so each node can show previous → proposed spend.
  useEffect(() => { void fetch("/api/sim/ads/campaigns", { cache: "no-store" }).then(r => r.json()).then(b => setBudgets(Object.fromEntries(b.campaigns.map((c: { campaignId: string; dailyBudgetMinor: number }) => [c.campaignId, c.dailyBudgetMinor])))).catch(() => {}); }, [approval?.approvalId]);
  return <div className="space-y-6">
    <section className="bg-slate-900 border border-slate-700 p-6 rounded-xl space-y-3"><h2 className="text-xl font-bold">{plan.objective}</h2><p>{plan.summary}</p><p className="text-sm text-amber-300">v{plan.planVersion} · Expires {new Date(plan.expiresAt).toLocaleString()}</p><h3 className="font-bold">Diagnosis: {diagnosis.output.primaryCause.replaceAll("_"," ")}</h3>{diagnosis.output.supportedHypotheses.map(h=><p key={h.cause} className="text-sm">{Math.round(h.confidence*100)}% · {h.rationale}</p>)}{evidence.map(e=><p key={e.evidenceId} className="text-sm text-slate-400">{e.evidenceId}: {e.observedFact}</p>)}</section>
    <PlanFlowchart handoff={handoff} approval={approval} budgets={budgets} selected={selected} toggle={id=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id])}/>
    <section className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4"><p>{selected.length}/{all.length} actions selected · Selection is not approval</p><textarea aria-label="Change request note" placeholder="Change request note" className="w-full p-3 bg-slate-950 rounded border border-slate-700" value={note} onChange={e=>setNote(e.target.value)}/><div className="flex flex-wrap gap-4">
      <button className="bg-sky-500 text-slate-950 rounded px-4 py-2 disabled:opacity-40" disabled={isApproving} onClick={()=>onApprove(all,"approved")}>Approve all</button>
      <button className="bg-sky-800 rounded px-4 py-2 disabled:opacity-40" disabled={isApproving||!selected.length} onClick={()=>onApprove(selected,selected.length===all.length?"approved":"partially_approved")}>Approve selected</button>
      <button disabled={isApproving} onClick={()=>onApprove([],"rejected")}>Reject</button>
      <button disabled={isApproving||!note.trim()} onClick={()=>onApprove([],"rejected",note)}>Request changes</button>
    </div><p className="text-xs text-slate-400">Request changes rejects this version with your note. An edited plan must use a new version.</p></section>
  </div>;
}

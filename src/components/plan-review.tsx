"use client";
import { useState } from "react";
import type { PlanHandoffT, PlanApprovalT } from "../contracts";
import { PlanFlowchart } from "./plan-flowchart";
import type { ExecutionSnapshot } from "../hooks/use-plan-executions";
export function PlanReview({ handoff, snapshot, approval, onApprove, isApproving }: { handoff: PlanHandoffT; snapshot: ExecutionSnapshot | null; approval: PlanApprovalT | null; onApprove: (ids:string[],decision:"approved"|"partially_approved"|"rejected",note?:string)=>Promise<void>; isApproving:boolean }) {
  const {plan,diagnosis,evidence} = handoff, all = plan.actions.map(a=>a.actionId);
  const [selected,setSelected] = useState(all), [note,setNote] = useState("");
  return <div className="space-y-6">
    <section className="bg-white border border-slate-200 p-6 rounded-xl space-y-3"><h2 className="text-xl font-bold">{plan.objective}</h2><p>{plan.summary}</p><p className="text-sm text-amber-700">v{plan.planVersion} · Expires {new Date(plan.expiresAt).toLocaleString()}</p><h3 className="font-bold">Diagnosis: {diagnosis.output.primaryCause.replaceAll("_"," ")}</h3>{diagnosis.output.supportedHypotheses.map(h=><p key={h.cause} className="text-sm">{h.strength ? `${h.strength} evidence` : `${Math.round(h.confidence*100)}%`} · {h.rationale}</p>)}{evidence.map(e=><p key={e.evidenceId} className="text-sm text-slate-500">{e.evidenceId}: {e.observedFact}</p>)}</section>
    <PlanFlowchart handoff={handoff} approval={approval} executions={snapshot?.executions} details={snapshot?.details} selected={selected} toggle={id=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id])}/>
    <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"><p>{selected.length}/{all.length} actions selected · Selection is not approval</p><textarea aria-label="Change request note" placeholder="Change request note" className="w-full p-3 bg-slate-50 rounded border border-slate-200" value={note} onChange={e=>setNote(e.target.value)}/><div className="flex flex-wrap gap-4">
      <button className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-40" disabled={isApproving} onClick={()=>onApprove(all,"approved")}>Approve all</button>
      <button className="bg-blue-50 text-blue-700 rounded px-4 py-2 disabled:opacity-40" disabled={isApproving||!selected.length} onClick={()=>onApprove(selected,selected.length===all.length?"approved":"partially_approved")}>Approve selected</button>
      <button className="rounded px-4 py-2 border border-slate-200 disabled:opacity-40" disabled={isApproving} onClick={()=>onApprove([],"rejected")}>Reject</button>
      <button className="rounded px-4 py-2 border border-amber-200 text-amber-800 disabled:opacity-40" disabled={isApproving||!note.trim()} onClick={()=>onApprove([],"rejected",note)}>Request changes</button>
    </div><p className="text-xs text-slate-500">Approving dispatches the approved agents immediately. Request changes rejects this version with your note; an edited plan must use a new version.</p></section>
  </div>;
}

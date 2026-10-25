'use client';
import type { PlanHandoffT } from "@/execution/types";
// Adapted from origin/kris src/components/plan-review.tsx.
import { agentDisplayName } from '@/agents/roles';
import type { ActionExecutionT,AgentMissionT,PlanApprovalT } from '@normal/contracts';
import { useState } from 'react';
export interface ExecutionView {approval:PlanApprovalT|null; reviewedHandoff:PlanHandoffT|null;run:{status:string;startedAt:string}|null;executions:ActionExecutionT[];missions:AgentMissionT[]}
export function PlanReview({handoff,snapshot,onApprove,onExecute,busy,ready}:{handoff:PlanHandoffT;snapshot:ExecutionView;onApprove:(ids:string[],decision:'approved'|'rejected'|'changes_requested',comment:string)=>Promise<void>;onExecute:()=>Promise<void>;busy:boolean;ready:boolean}) {
 const {plan,diagnosis,evidence}=handoff, all=plan.actions.map(a=>a.actionId);
 const [selected,setSelected]=useState(all),[note,setNote]=useState('');
 const decided=!!snapshot.approval;
 const displayedSelection=snapshot.approval?.approvedActionIds??selected;
 return <div className="space-y-6 text-slate-900">
  <section className="bg-white border border-slate-200 p-6 rounded-xl space-y-3"><h2 className="text-xl font-bold">{plan.objective}</h2><p className="whitespace-pre-line text-sm">{plan.summary}</p><p className="text-sm text-amber-700">Version {plan.planVersion} · Expires {new Date(plan.expiresAt).toLocaleString()}</p><h3 className="font-bold">Diagnosis: {diagnosis.primaryCause.replaceAll('_',' ')}</h3>{evidence.map(e=><p key={e.evidenceId} className="text-sm text-slate-500">{e.evidenceId}: {e.observation}</p>)}</section>
  <div className="grid gap-4">{plan.actions.map(a=><section key={a.actionId} className="bg-white border border-slate-200 p-5 rounded-xl space-y-3"><label className="flex gap-3 items-center"><input type="checkbox" disabled={decided||busy} checked={displayedSelection.includes(a.actionId)} onChange={()=>setSelected(s=>s.includes(a.actionId)?s.filter(x=>x!==a.actionId):[...s,a.actionId])}/><strong>{a.title}</strong><span className="text-sm text-slate-500">{agentDisplayName(a.agent)} · {a.risk} risk</span></label><pre className="bg-slate-50 rounded p-3 text-xs overflow-auto">{JSON.stringify(a.params,null,2)}</pre><p className="whitespace-pre-line text-sm">{a.rationale}</p>{a.dependsOnActionIds.length>0&&<p className="text-sm">After: {a.dependsOnActionIds.join(', ')}</p>}</section>)}</div>
  <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
   <p>{displayedSelection.length}/{all.length} actions {decided?'approved':'selected · Selection is not approval'}</p>
   {!decided&&<><textarea aria-label="Review comment" placeholder="Review comment" className="w-full p-3 bg-slate-50 rounded border border-slate-200" value={note} onChange={e=>setNote(e.target.value)}/><div className="flex flex-wrap gap-3">
   <button className="btn primary" disabled={busy||!ready} onClick={()=>onApprove(all,'approved',note)}>Approve exact version</button>
   <button className="btn" disabled={busy||!ready||!selected.length} onClick={()=>onApprove(selected,'approved',note)}>Approve selected</button>
   <button className="btn" disabled={busy||!ready} onClick={()=>onApprove([],'rejected',note)}>Reject</button>
   <button className="btn" disabled={busy||!ready||!note.trim()} onClick={()=>onApprove([],'changes_requested',note)}>Request changes</button></div></>}
   {snapshot.approval&&<p data-testid="approval-decision">{snapshot.approval.decision} · v{snapshot.approval.planVersion} · {snapshot.approval.reviewedByUserId} · {snapshot.approval.reviewedAt}</p>}
   {snapshot.approval?.decision==='approved'&&!snapshot.run&&<button className="btn primary" disabled={busy||!ready} onClick={onExecute}>Execute approved actions</button>}
   <p className="text-xs text-slate-500">Human approval and execution are separate steps. This simulation uses the local demo operator; production identity integration remains required. Decisions are immutable; changes require a new plan version.</p>
  </section>
  {snapshot.run&&<section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4" data-testid="execution-results"><h3 className="font-bold">Execution activity · {snapshot.run.status}</h3>{snapshot.missions.map(m=><p key={m.missionId}>{agentDisplayName(m.agent)} · {m.status}</p>)}{snapshot.executions.map(e=><div key={e.executionId}><strong>{e.toolName} · {e.status}</strong><p>{e.result?.verification??e.error?.message??'Awaiting durable completion. Do not replay an interrupted attempt.'}</p><p className="text-xs break-all text-slate-500">{e.executionId}</p></div>)}</section>}
 </div>;
}

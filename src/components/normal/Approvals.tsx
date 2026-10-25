'use client';
import type {PlanHandoffT} from "@/execution/types";
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import type {ProposedPlanT} from '@normal/contracts';
import {api,q} from './api';
import {useRun} from './run-context';
import {PlanReview,type ExecutionView} from '@/components/partner/PlanReview';
type Row=ExecutionView&{plan:ProposedPlanT};
export function Approvals({activity=false}:{activity?:boolean}) {const {runId}=useRun();return <ApprovalsContent key={runId} activity={activity}/>;}
function ApprovalsContent({activity=false}:{activity?:boolean}) {
 const {businessId,runId,withRun}=useRun();
 const [rows,setRows]=useState<Row[]>([]),[selected,setSelected]=useState<string|null>(null),[handoff,setHandoff]=useState<PlanHandoffT|null>(null),[snapshot,setSnapshot]=useState<ExecutionView|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
 const load=useCallback(async()=>{if(!runId)return;try{const result=await api<{plans:Row[]}>(`/api/approvals?${q({businessId,simulationRunId:runId})}`);setRows(result.plans);setError('');}catch(e){setError((e as Error).message)}},[businessId,runId]);
 useEffect(()=>{let live=true;void Promise.resolve().then(()=>{if(live){setSelected(null);setHandoff(null);setSnapshot(null);setRows([]);void load()}});return()=>{live=false}},[load]);
 const inspect=async(row:Row)=>{setSelected(`${row.plan.planId}:${row.plan.planVersion}`);setHandoff(null);setSnapshot(row);setReady(false);setError('');try{const h=await api<PlanHandoffT>(`/api/plans/${row.plan.planId}?${q({businessId,simulationRunId:runId,planVersion:row.plan.planVersion})}`);setHandoff(h);setReady(true)}catch(e){setHandoff(row.reviewedHandoff);if(!row.run)setError((e as Error).message)}};
 const act=async(action:string,body:unknown)=>{if(!handoff||!runId)return;setBusy(true);setError('');try{const query=q({businessId,simulationRunId:runId,planVersion:handoff.plan.planVersion});await api(`/api/plans/${handoff.plan.planId}/${action}?${query}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});setSnapshot(await api<ExecutionView>(`/api/plans/${handoff.plan.planId}/executions?${query}`));await load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 return <div className="space-y-6"><div className="row"><h2>{activity?'Agent execution activity':'Review proposed plans'}</h2><button className="btn" onClick={load}>Refresh</button><Link className="btn" href={withRun(activity?'/dashboard/approvals':'/dashboard/activity')}>{activity?'Approvals':'Execution activity'}</Link></div><p className="muted">Exact versions, human decisions and simulator receipts for {runId??'the selected run'}.</p>{error&&<div role="alert" className="alert error">{error}</div>}
 <div className="grid gap-3">{rows.filter(r=>!activity||r.run).map(row=><button className="card text-left p-4" key={`${row.plan.planId}:${row.plan.planVersion}`} onClick={()=>inspect(row)}><strong>{row.plan.objective}</strong><p className="muted">v{row.plan.planVersion} · {row.run?.status??row.approval?.decision??'awaiting approval'} · {row.plan.planId}</p></button>)}</div>{rows.filter(r=>!activity||r.run).length===0&&<p className="empty">{activity?'No execution attempts in this run.':'No submitted plans in this run. Prepare a plan from an investigation.'}</p>}
 {handoff&&snapshot&&<PlanReview key={selected} handoff={handoff} snapshot={snapshot} ready={ready} busy={busy} onApprove={(ids,decision,comment)=>act('approve',{decision,approvedActionIds:ids,comment})} onExecute={()=>act('execute',{approvalId:snapshot.approval?.approvalId})}/>}
 </div>;
}

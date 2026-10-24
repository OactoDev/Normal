"use client";
import type { ExecutionSnapshot } from "../hooks/use-plan-executions";
import { ExecutionLog } from "./execution-log";
import { agentRoles } from "../agents/roles";
export const AGENT_NAMES: Record<string, string> = Object.fromEntries(agentRoles.map(r=>[r.id,r.name]));
const STATUS_COLOURS: Record<string, string> = { succeeded: "text-emerald-700", failed: "text-red-600", cancelled: "text-red-600", running: "text-blue-600 animate-pulse", queued: "text-slate-500" };
type SendRecord = { orderId: string; status: string; provider: string };
export function AgentMissionControl({data,busy,onExecute,onReset}:{data:ExecutionSnapshot|null;busy:boolean;onExecute:(ids?:string[])=>Promise<void>;onReset:()=>Promise<void>}) {
  // Mirrors resetDemo: a run stuck for over two minutes no longer blocks the reset button.
  const active = data?.executions.some(e=>e.status==="queued"||(e.status==="running"&&Date.now()-Date.parse(e.startedAt)<120000));
  return <div className="space-y-6"><section className="bg-white border border-slate-200 rounded-xl p-5 flex justify-between gap-4"><div><h2 className="text-xl font-bold">Agent Mission Control</h2><p className="text-sm text-slate-500">Approval: {data?.approval?.approvalId || "Not approved"}{data?.approval && ` · ${data.approval.decision} by ${data.approval.reviewingPrincipal}`}</p>{data?.needsAttention && <p className="text-amber-700">Needs attention: review errors below.</p>}</div><div className="flex gap-4"><button disabled={busy||active||!data?.approval||data.approval.decision==="rejected"} onClick={()=>onExecute()} className="bg-emerald-600 p-3 rounded disabled:opacity-40">{active?"Executing…":"Execute approved / retry"}</button><button disabled={busy||active} onClick={onReset}>Reset demo</button></div></section>
    <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"><h3 className="font-bold">Specialist roles · One execution system</h3><div className="grid md:grid-cols-3 gap-4">{agentRoles.map(role=><div key={role.id}><h4 className="text-blue-600">{role.name} <span className="text-xs text-slate-500">{role.phase}</span></h4><p className="text-xs text-slate-500">{role.description}</p><p className="text-xs mt-1">{role.mode==="proposal_only"?"Planned — execution tools not enabled":role.tools.join(", ")}</p></div>)}</div></section>
    <div className="grid md:grid-cols-3 gap-4">{data?.missions.map(m=><section key={m.missionId} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"><h3 className="font-bold text-blue-600">{AGENT_NAMES[m.assignedAgent] || m.assignedAgent} · {m.status.replace("_"," ")}</h3><p className="text-sm">{m.goal}</p>{data.executions.filter(e=>e.missionId===m.missionId).map(e=>{
      const sends = (data.emailSends?.filter(s=>s.actionId===e.actionId) ?? data.details.find(d=>d.executionId===e.executionId)?.payload.emails) as SendRecord[] | undefined;
      return <div key={e.executionId} className="bg-slate-50 p-3 rounded space-y-2 text-sm"><p className="font-mono text-xs">{e.toolName}</p><strong className={STATUS_COLOURS[e.status]}>{e.status}</strong><p className="text-xs text-slate-500">Attempts: {e.attempts} · key {e.idempotencyKey}</p>
        {sends?.length > 0 && <p>{sends.filter(s=>["accepted","delivered"].includes(s.status)).length}/{sends.length} accepted by {sends[0]?.provider} · {sends.filter(s=>s.status==="delivered").length} delivered</p>}
        {e.error && <p className="text-red-600">{e.error.code}: {e.error.message}</p>}{e.result && <p>{e.result.verification}</p>}
        {e.error?.retryable && <button disabled={busy||active} className="text-blue-600" onClick={()=>onExecute([e.actionId])}>Retry safely</button>}
        {e.error && !e.error.retryable && <p className="text-xs text-slate-500">{e.error.code === "EMAIL_AMBIGUOUS" ? "Not retried: the provider may already have sent this message." : "Not retryable as-is: fix the cause above first."}</p>}</div>;
    })}</section>)}</div><ExecutionLog logs={data?.logs || []} executions={data?.executions || []}/>
  </div>;
}

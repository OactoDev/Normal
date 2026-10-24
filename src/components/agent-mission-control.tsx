"use client";
import type { ExecutionSnapshot } from "../hooks/use-plan-executions";
import { ExecutionLog } from "./execution-log";
export const AGENT_NAMES: Record<string, string> = { marketing: "Marketing Agent", customer_care: "Customer Care Agent", storefront: "Storefront Agent", supplier: "Supplier Agent", growth: "Growth Agent" };
const STATUS_COLOURS: Record<string, string> = { succeeded: "text-emerald-400", failed: "text-red-400", cancelled: "text-red-400", running: "text-sky-300 animate-pulse", queued: "text-slate-400" };
type SendRecord = { orderId: string; status: string; provider: string };
export function AgentMissionControl({data,busy,onExecute,onReset}:{data:ExecutionSnapshot|null;busy:boolean;onExecute:(ids?:string[])=>Promise<void>;onReset:()=>Promise<void>}) {
  // Mirrors resetDemo: a run stuck for over two minutes no longer blocks the reset button.
  const active = data?.executions.some(e=>e.status==="queued"||(e.status==="running"&&Date.now()-Date.parse(e.startedAt)<120000));
  return <div className="space-y-6"><section className="bg-slate-900 border border-slate-700 rounded-xl p-5 flex justify-between gap-4"><div><h2 className="text-xl font-bold">Agent Mission Control</h2><p className="text-sm text-slate-400">Approval: {data?.approval?.approvalId || "Not approved"}{data?.approval && ` · ${data.approval.decision} by ${data.approval.reviewingPrincipal}`}</p>{data?.needsAttention && <p className="text-amber-400">Needs attention: review errors below.</p>}</div><div className="flex gap-4"><button disabled={busy||active||!data?.approval||data.approval.decision==="rejected"} onClick={()=>onExecute()} className="bg-emerald-600 p-3 rounded disabled:opacity-40">{active?"Executing…":"Execute approved / retry"}</button><button disabled={busy||active} onClick={onReset}>Reset demo</button></div></section>
    <div className="grid md:grid-cols-3 gap-4">{data?.missions.map(m=><section key={m.missionId} className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4"><h3 className="font-bold text-sky-400">{AGENT_NAMES[m.assignedAgent] || m.assignedAgent} · {m.status.replace("_"," ")}</h3><p className="text-sm">{m.goal}</p>{data.executions.filter(e=>e.missionId===m.missionId).map(e=>{
      const sends = data.details.find(d=>d.executionId===e.executionId)?.payload.emails as SendRecord[] | undefined;
      return <div key={e.executionId} className="bg-slate-950 p-3 rounded space-y-2 text-sm"><p className="font-mono text-xs">{e.toolName}</p><strong className={STATUS_COLOURS[e.status]}>{e.status}</strong><p className="text-xs text-slate-400">Attempts: {e.attempts} · key {e.idempotencyKey}</p>
        {sends && <p>{sends.filter(s=>["accepted","delivered"].includes(s.status)).length}/{sends.length} recipients accepted by {sends[0]?.provider}</p>}
        {e.error && <p className="text-red-300">{e.error.code}: {e.error.message}</p>}{e.result && <p>{e.result.verification}</p>}
        {e.error?.retryable && <button disabled={busy||active} className="text-sky-400" onClick={()=>onExecute([e.actionId])}>Retry safely</button>}
        {e.error && !e.error.retryable && <p className="text-xs text-slate-400">{e.error.code === "EMAIL_AMBIGUOUS" ? "Not retried: the provider may already have sent this message." : "Not retryable as-is: fix the cause above first."}</p>}</div>;
    })}</section>)}</div><ExecutionLog logs={data?.logs || []} executions={data?.executions || []}/>
  </div>;
}

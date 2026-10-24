"use client";
import type { PlanHandoffT } from "../contracts";
import type { ExecutionSnapshot } from "../hooks/use-plan-executions";
import { ExecutionLog } from "./execution-log";
import { PlanFlowchart } from "./plan-flowchart";
import { agentRoles, agentDisplayName } from "../agents/roles";
import { clock, duration } from "../lib/format";
type Execution = ExecutionSnapshot["executions"][number];
type SendRecord = { orderId: string; status: string; provider: string };
const PILL: Record<string, string> = { succeeded: "bg-emerald-100 text-emerald-800", failed: "bg-red-100 text-red-700", cancelled: "bg-red-100 text-red-700", running: "bg-blue-100 text-blue-700", queued: "bg-slate-100 text-slate-600" };
const MISSION_PILL: Record<string, string> = { completed: "bg-emerald-100 text-emerald-800", failed: "bg-red-100 text-red-700", cancelled: "bg-red-100 text-red-700", in_progress: "bg-blue-100 text-blue-700", assigned: "bg-slate-100 text-slate-600" };
const label = (s: string) => ({ succeeded: "Verified", in_progress: "Working", assigned: "Assigned" } as Record<string, string>)[s] ?? s.charAt(0).toUpperCase() + s.slice(1);

/** queued → running → verifying → done, each step timed from the persisted execution record and its audit log. */
function Timeline({ execution, logs }: { execution: Execution; logs: ExecutionSnapshot["logs"] }) {
  const mine = logs.filter(l => l.executionId === execution.executionId);
  const at = (message: string) => [...mine].reverse().find(l => l.message === message)?.at;
  const queuedAt = at("manual retry queued") ?? at("queued"), verifyingAt = at("tool completed; verifying stored effect");
  const failed = execution.status === "failed" || execution.status === "cancelled";
  const steps = [
    { name: "Queued", at: queuedAt, done: true },
    { name: "Running", at: execution.startedAt, done: !!execution.startedAt },
    { name: "Verifying", at: verifyingAt, done: !!verifyingAt },
    { name: failed ? label(execution.status) : "Verified", at: execution.finishedAt, done: execution.status === "succeeded" || failed },
  ];
  const current = steps.findIndex(s => !s.done);
  return <ol className="flex items-start gap-1" aria-label={`${execution.toolName} timeline`}>{steps.map((s, i) => {
    const colour = !s.done ? (i === current && execution.status === "running" ? "bg-blue-500 animate-pulse" : "bg-slate-200") : i === 3 && failed ? "bg-red-500" : "bg-emerald-500";
    return <li key={s.name} className="flex-1 min-w-0"><div className={`h-1.5 rounded-full ${colour}`} /><p className={`mt-1 text-[11px] ${s.done ? "text-slate-700" : "text-slate-400"}`}>{s.name}</p><p className="text-[10px] text-slate-400 tabular-nums">{s.at ? clock(s.at) : "—"}</p></li>;
  })}</ol>;
}

export function AgentMissionControl({handoff,data,busy,onExecute,onReset,onReview}:{handoff:PlanHandoffT|null;data:ExecutionSnapshot|null;busy:boolean;onExecute:(ids?:string[])=>Promise<void>;onReset:()=>Promise<void>;onReview:()=>void}) {
  // Mirrors resetDemo: a run stuck for over two minutes no longer blocks the reset button.
  const active = data?.executions.some(e=>e.status==="queued"||(e.status==="running"&&Date.now()-Date.parse(e.startedAt)<120000));
  const version = handoff?.plan.planVersion, executions = (data?.executions ?? []).filter(e => version === undefined || e.planVersion === version);
  const approved = data?.approval && data.approval.decision !== "rejected" && data.approval.planVersion === version;
  const verified = executions.filter(e => e.status === "succeeded").length, total = approved ? data.approval.approvedActionIds.length : 0;
  const started = executions.map(e => e.startedAt).filter(Boolean).sort()[0], finished = !active && executions.length ? executions.map(e => e.finishedAt).filter(Boolean).sort().at(-1) : undefined;
  const pending = approved && data.approval.approvedActionIds.some(id => !executions.some(e => e.actionId === id && e.status === "succeeded"));
  // Only the specialists this plan actually dispatched; proposal-only roles stay out of the live view.
  const missions = (data?.missions ?? []).filter(m => executions.some(e => e.missionId === m.missionId));
  const heading = active ? `${missions.length} specialists working` : executions.length && verified === executions.length ? "Recovery carried out" : executions.length ? "Run finished with issues" : approved ? "Ready to dispatch" : "Waiting for merchant approval";

  return <div className="space-y-6">
    <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-400">Agent Mission Control</p>
          <h2 className="text-xl font-bold flex items-center gap-2">{active && <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />}{heading}</h2>
          {handoff && <p className="text-sm text-slate-600">{handoff.plan.objective}</p>}
          <p className="text-xs text-slate-500">{data?.approval ? `Approval ${data.approval.approvalId.slice(0, 8)} · ${data.approval.decision.replace("_", " ")} by ${data.approval.reviewingPrincipal}` : "Not approved yet"}{started && ` · started ${clock(started)}`}{started && ` · ${active ? "elapsed" : "took"} ${duration(started, active ? undefined : finished)}`}</p>
          {data?.needsAttention && <p className="text-sm text-amber-700">Needs attention: an action failed or was cancelled. Details below.</p>}
        </div>
        <div className="flex items-center gap-3">
          <button disabled={busy||active||!approved||!pending} onClick={()=>onExecute()} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none">{active?"Agents running…":executions.length?"Run remaining / retry":"Dispatch approved agents"}</button>
          <button disabled={busy||active} onClick={onReset} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40">Reset demo</button>
        </div>
      </div>
      {total > 0 && <div><div className="flex justify-between text-xs text-slate-500 mb-1"><span>{verified} of {total} approved actions verified</span><span>{executions.filter(e=>e.status==="running").length} running · {executions.filter(e=>e.status==="queued").length} queued</span></div><div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(verified / total) * 100}%` }} /></div></div>}
    </section>

    {!executions.length ? <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-3">
      <h3 className="text-lg font-semibold">{approved ? "Approved and waiting for dispatch" : "No agents dispatched yet"}</h3>
      <p className="text-sm text-slate-500 max-w-xl mx-auto">{approved ? "The approved specialists are ready. Dispatch them to start the recovery." : "Each specialist only acts after the merchant approves its step. Review the recovery plan to approve it; approval dispatches the agents straight away."}</p>
      <div className="flex justify-center gap-3 text-xs text-slate-500">{agentRoles.filter(r => r.mode === "execution" && r.id !== "orchestrator" && handoff?.plan.actions.some(a => a.agent === r.id)).map(r => <span key={r.id} className="rounded-full border border-slate-200 px-3 py-1">{r.name}</span>)}</div>
      {!approved && <button onClick={onReview} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">Open plan review</button>}
    </section> : <>
      {handoff && <PlanFlowchart handoff={handoff} approval={approved ? data.approval : null} executions={executions} details={data.details} />}
      <div className="grid md:grid-cols-3 gap-4">{missions.map(m=>{
        const role = agentRoles.find(r => r.id === m.assignedAgent);
        return <section key={m.missionId} className={`bg-white border rounded-xl p-5 space-y-4 ${m.status === "in_progress" ? "border-blue-300 shadow-sm" : "border-slate-200"}`}>
          <div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{agentDisplayName(m.assignedAgent)}</h3>{role && <p className="text-xs text-slate-500 mt-0.5">{role.description}</p>}</div><span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${MISSION_PILL[m.status] ?? ""}`}>{label(m.status)}</span></div>
          {executions.filter(e=>e.missionId===m.missionId).map(e=>{
            const action = handoff?.plan.actions.find(a => a.actionId === e.actionId);
            const sends = (data.emailSends?.filter(s=>s.actionId===e.actionId) ?? data.details.find(d=>d.executionId===e.executionId)?.payload.emails) as SendRecord[] | undefined;
            return <div key={e.executionId} className="rounded-lg bg-slate-50 p-3 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-2"><div><p className="font-medium leading-snug">{action?.title ?? e.actionId}</p><p className="font-mono text-[11px] text-slate-500">{e.toolName}</p></div><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${PILL[e.status]}`}>{label(e.status)}</span></div>
              <Timeline execution={e} logs={data.logs} />
              <p className="text-xs text-slate-500 tabular-nums">{e.startedAt ? `${e.status === "running" ? "Running for" : "Took"} ${duration(e.startedAt, e.finishedAt)}` : "Waiting to start"} · attempt {e.attempts}</p>
              {sends?.length > 0 && <p className="text-xs">{sends.filter(s=>["accepted","delivered"].includes(s.status)).length}/{sends.length} accepted by {sends[0]?.provider} · {sends.filter(s=>s.status==="delivered").length} delivered</p>}
              {e.result && <p className="text-xs text-emerald-800">✓ {e.result.verification}</p>}
              {e.error && <p className="text-xs text-red-600">{e.error.code}: {e.error.message}</p>}
              {e.error?.retryable && <button disabled={busy||active} className="text-xs font-medium text-blue-700 hover:underline disabled:opacity-40" onClick={()=>onExecute([e.actionId])}>Retry safely</button>}
              {e.error && !e.error.retryable && <p className="text-xs text-slate-500">{e.error.code === "EMAIL_AMBIGUOUS" ? "Not retried: the provider may already have sent this message." : "Not retryable as-is: fix the cause above first."}</p>}
            </div>;
          })}
        </section>;
      })}</div>
    </>}
    <ExecutionLog logs={data?.logs || []} executions={data?.executions || []}/>
  </div>;
}

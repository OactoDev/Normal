"use client";
import { ReactFlow, Background, Controls, Node, Edge, MarkerType, Position, useNodesState } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useState } from "react";
import type { PlanHandoffT, ActionProposalT, PlanApprovalT } from "../contracts";
import type { ExecutionSnapshot } from "../hooks/use-plan-executions";
import { shippingDelayTemplate } from "../tools/email-templates";
import { agentDisplayName } from "../agents/roles";
import { money } from "../lib/format";
type Execution = ExecutionSnapshot["executions"][number];
type Detail = ExecutionSnapshot["details"][number];
// The budget before the change: the tool's own read-back once it ran, otherwise the live simulated ad platform.
function budgetBefore(a: ActionProposalT, budgets: Record<string, number>, detail?: Detail) {
  const read = detail?.payload.previousBudgetMinor;
  return read !== undefined ? Number(read) : budgets[String(a.params.campaignId)];
}
function summary(a: ActionProposalT, budgets: Record<string, number>, detail?: Detail) {
  const p = a.params;
  if (a.actionType === "ads.set_daily_budget") {
    const current = budgetBefore(a, budgets, detail), next = Number(p.newDailyBudgetMinor), c = String(p.currency);
    return current === undefined ? `${money(next, c)}/day target` : `${money(current, c)} → ${money(next, c)}/day`;
  }
  if (a.actionType === "customer.send_delay_notice") return `${(p.orderIds as string[]).length} delayed orders, max ${p.maxRecipients} emails · controlled test inbox only`;
  return `"${p.message}" · ${new Date(String(p.startsAt)).toLocaleString("en-GB")} → ${new Date(String(p.expiresAt)).toLocaleString("en-GB")}`;
}
/** What the merchant should see once the action is verified, stated from the plan's own parameters. */
function expected(a: ActionProposalT, budgets: Record<string, number>, detail?: Detail) {
  const p = a.params;
  if (a.actionType === "ads.set_daily_budget") {
    const current = budgetBefore(a, budgets, detail), next = Number(p.newDailyBudgetMinor), c = String(p.currency);
    if (current === undefined) return `Daily budget set to ${money(next, c)}`;
    return next < current ? `${money(current - next, c)}/day less ad spend (${money(current, c)} → ${money(next, c)})` : `${money(next - current, c)}/day more ad spend (${money(current, c)} → ${money(next, c)})`;
  }
  if (a.actionType === "customer.send_delay_notice") return `${Math.min((p.orderIds as string[]).length, Number(p.maxRecipients))} customers with delayed orders notified by email`;
  return `Delivery notice live on the store until ${new Date(String(p.expiresAt)).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}
function approvalState(a: ActionProposalT, approval: PlanApprovalT | null) {
  if (!approval) return { label: "Awaiting approval", colour: "bg-amber-50 text-amber-700" };
  if (approval.decision === "rejected") return { label: "Rejected", colour: "bg-red-50 text-red-700" };
  return approval.approvedActionIds.includes(a.actionId) ? { label: "Approved", colour: "bg-emerald-50 text-emerald-700" } : { label: "Not approved", colour: "bg-slate-100 text-slate-500" };
}
const RUN_STATE: Record<string, { label: string; colour: string; border: string; background: string; edge: string }> = {
  queued: { label: "Queued", colour: "bg-slate-100 text-slate-600", border: "#94a3b8", background: "#f8fafc", edge: "#94a3b8" },
  running: { label: "Running", colour: "bg-blue-100 text-blue-700", border: "#3b82f6", background: "#eff6ff", edge: "#3b82f6" },
  succeeded: { label: "Verified", colour: "bg-emerald-100 text-emerald-700", border: "#10b981", background: "#ecfdf5", edge: "#10b981" },
  failed: { label: "Failed", colour: "bg-red-100 text-red-700", border: "#ef4444", background: "#fef2f2", edge: "#ef4444" },
  cancelled: { label: "Cancelled", colour: "bg-red-100 text-red-700", border: "#ef4444", background: "#fef2f2", edge: "#ef4444" },
};
export function PlanFlowchart({ handoff, approval, executions = [], details = [], selected, toggle }: { handoff: PlanHandoffT; approval: PlanApprovalT | null; executions?: Execution[]; details?: Detail[]; selected?: string[]; toggle?: (id: string)=>void }) {
  const [focused,setFocused] = useState<ActionProposalT | null>(null), [budgets,setBudgets] = useState<Record<string, number>>({}), actions = handoff.plan.actions;
  // Current budgets come from the simulated ad platform so each node can show previous → proposed spend.
  useEffect(() => { void fetch("/api/sim/ads/campaigns", { cache: "no-store" }).then(r => r.json()).then(b => setBudgets(Object.fromEntries(b.campaigns.map((c: { campaignId: string; dailyBudgetMinor: number }) => [c.campaignId, c.dailyBudgetMinor])))).catch(() => {}); }, [approval?.approvalId]);
  const runFor = (id: string) => executions.find(e => e.actionId === id && e.planVersion === handoff.plan.planVersion);
  const detailFor = (id: string) => { const run = runFor(id); return run && details.find(d => d.executionId === run.executionId); };
  function depth(a: ActionProposalT, seen = new Set<string>()): number {
    if (seen.has(a.actionId)) return 1;
    const next = new Set(seen).add(a.actionId);
    return 1+Math.max(0,...a.dependsOnActionIds.map(id=>{const dep=actions.find(a=>a.actionId===id); return dep ? depth(dep,next) : 0;}));
  }
  const approvalKey = approval ? `${approval.approvalId}:${approval.decision}` : "";
  const runKey = actions.map(a => `${a.actionId}:${runFor(a.actionId)?.status ?? ""}:${detailFor(a.actionId) ? 1 : 0}`).join("|");
  const built = useMemo(() => {
    const rows = new Map<number,number>(), spacing = 250;
    const positioned = actions.map(a => { const d = depth(a), row = rows.get(d)||0; rows.set(d,row+1); return { a, d, row }; });
    const tallest = Math.max(1, ...rows.values());
    return [{ id:"diagnosis",position:{x:0,y:((tallest-1)*spacing)/2+40},sourcePosition:Position.Right,targetPosition:Position.Left,data:{label:<div className="text-left"><span className="text-[11px] uppercase tracking-wide text-slate-400">Diagnosed root cause</span><strong className="block text-base capitalize">{handoff.diagnosis.output.primaryCause.replaceAll("_"," ")}</strong><span className="text-xs text-slate-300">{actions.length} coordinated actions</span></div>},style:{background:"#0f172a",color:"white",width:220,borderRadius:12,border:"none",padding:14} },...positioned.map(({ a, d, row })=>{
    const run = runFor(a.actionId), state = run && RUN_STATE[run.status], gate = approvalState(a, approval), isSelected = selected?.includes(a.actionId), detail = detailFor(a.actionId);
    return {id:a.actionId,position:{x:d*340,y:row*spacing},sourcePosition:Position.Right,targetPosition:Position.Left,className:run?.status === "running" ? "node-running" : undefined,data:{label:<div className="text-left space-y-1.5">
      <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-700">{agentDisplayName(a.agent)}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${state ? state.colour : gate.colour}`}>{state ? state.label : gate.label}</span></div>
      <strong className="block text-sm leading-snug">{a.title}</strong>
      <p className="text-xs text-slate-500 leading-snug">{a.rationale}</p>
      <p className="text-xs leading-snug rounded-md bg-white/70 border border-slate-200 px-2 py-1"><span className="text-slate-400">Expected · </span>{expected(a, budgets, detail)}</p>
      <p className="text-[11px] text-slate-400">{a.risk} risk · {a.actionType}{a.dependsOnActionIds.length > 0 && ` · after ${a.dependsOnActionIds.join(", ")}`}</p>
      {toggle && !run && <label className="nodrag flex gap-2 text-xs"><input type="checkbox" checked={!!isSelected} onChange={()=>toggle(a.actionId)} onClick={e=>e.stopPropagation()} /> Select for approval</label>}
    </div>},style:{width:290,background:state ? state.background : isSelected ? "#eff6ff" : "#ffffff",color:"#0f172a",border:`${run?.status === "running" ? 2 : 1}px solid ${state ? state.border : "#cbd5e1"}`,borderRadius:12,transition:"background .3s, border-color .3s"}};
  })] as Node[];
  }, [handoff, selected, budgets, approvalKey, runKey]);
  // React Flow drops a node's handle positions when it receives a fresh node object without `measured`, and edges
  // need those positions. The cockpit re-renders on every poll, so keep measured sizes across rebuilds.
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(built);
  useEffect(() => { setNodes(prev => built.map(n => ({ ...n, measured: prev.find(p => p.id === n.id)?.measured }))); }, [built, setNodes]);
  const edges: Edge[] = useMemo(() => actions.flatMap(a=>(a.dependsOnActionIds.length?a.dependsOnActionIds:["diagnosis"]).map(id=>{
    const status = runFor(a.actionId)?.status, colour = status ? RUN_STATE[status].edge : "#94a3b8";
    // Work flows along an edge while its target is waiting or running; a finished edge settles into its result colour.
    return {id:`${id}:${a.actionId}`,source:id,target:a.actionId,animated:status === "running" || status === "queued",style:{stroke:colour,strokeWidth:status === "running" ? 3 : 2},markerEnd:{type:MarkerType.ArrowClosed,color:colour}};
  })), [actions, runKey]);
  return <div className="space-y-4"><div className="h-[560px] border border-slate-200 rounded-xl bg-white"><ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} fitView fitViewOptions={{padding:0.15}} colorMode="light" nodesDraggable={false} onNodeClick={(_,node)=>setFocused(actions.find(a=>a.actionId===node.id)||null)}><Background/><Controls/></ReactFlow></div>
    {focused && <aside className="rounded-xl bg-white border border-blue-200 p-5 space-y-3" aria-label="Action details"><button className="float-right" onClick={()=>setFocused(null)}>Close ×</button><h3 className="font-bold">{focused.title}</h3><p>{focused.rationale}</p><p className="text-sm text-blue-600">{summary(focused, budgets, detailFor(focused.actionId))}</p><p className="text-xs text-slate-500">{agentDisplayName(focused.agent)} · tool {focused.actionType} · {approvalState(focused, approval).label}</p>{handoff.evidence.filter(e=>focused.evidenceIds.includes(e.evidenceId)).map(e=><p key={e.evidenceId} className="text-sm text-slate-500">{e.evidenceId}: {e.observedFact}</p>)}{focused.actionType==="customer.send_delay_notice" && <div className="whitespace-pre-line p-4 bg-slate-50 rounded"><h4>Approved email preview · {shippingDelayTemplate.subject}</h4>{shippingDelayTemplate.render("Customer", "order", shippingDelayTemplate.paragraph)}<p className="text-xs text-slate-500">Only the personalised paragraph may be drafted via Mubit; template fallback is recorded honestly.</p></div>}</aside>}
  </div>;
}

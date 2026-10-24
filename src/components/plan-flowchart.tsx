"use client";
import { ReactFlow, Background, Controls, Node, Edge, MarkerType, Position, useNodesState } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useState } from "react";
import type { PlanHandoffT, ActionProposalT, PlanApprovalT } from "../contracts";
import { shippingDelayTemplate } from "../tools/email-templates";
const money = (minor: number, currency: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
function summary(a: ActionProposalT, budgets: Record<string, number>) {
  const p = a.params;
  if (a.actionType === "ads.set_daily_budget") {
    const current = budgets[String(p.campaignId)], next = Number(p.newDailyBudgetMinor), c = String(p.currency);
    return current === undefined ? `${money(next, c)}/day target` : `${money(current, c)} → ${money(next, c)}/day (${next < current ? "−" : "+"}${money(Math.abs(next - current), c)}/day spend)`;
  }
  if (a.actionType === "customer.send_delay_notice") return `${(p.orderIds as string[]).length} delayed orders, max ${p.maxRecipients} emails · controlled test inbox only`;
  return `"${p.message}" · ${new Date(String(p.startsAt)).toLocaleString()} → ${new Date(String(p.expiresAt)).toLocaleString()}`;
}
function approvalState(a: ActionProposalT, approval: PlanApprovalT | null) {
  if (!approval) return { label: "Awaiting approval", colour: "text-amber-300" };
  if (approval.decision === "rejected") return { label: "Rejected", colour: "text-red-400" };
  return approval.approvedActionIds.includes(a.actionId) ? { label: "Approved", colour: "text-emerald-400" } : { label: "Not approved", colour: "text-slate-400" };
}
export function PlanFlowchart({ handoff, selected, toggle, budgets, approval }: { handoff: PlanHandoffT; selected: string[]; toggle: (id: string)=>void; budgets: Record<string, number>; approval: PlanApprovalT | null }) {
  const [focused,setFocused] = useState<ActionProposalT | null>(null), actions = handoff.plan.actions;
  function depth(a: ActionProposalT, seen = new Set<string>()): number {
    if (seen.has(a.actionId)) return 1;
    const next = new Set(seen).add(a.actionId);
    return 1+Math.max(0,...a.dependsOnActionIds.map(id=>{const dep=actions.find(a=>a.actionId===id); return dep ? depth(dep,next) : 0;}));
  }
  const approvalKey = approval ? `${approval.approvalId}:${approval.decision}` : "";
  const built = useMemo(() => {
    const rows = new Map<number,number>();
    return [{ id:"diagnosis",position:{x:0,y:80},sourcePosition:Position.Right,targetPosition:Position.Left,data:{label:handoff.diagnosis.output.primaryCause.replaceAll("_"," ")},style:{background:"#172554",color:"white",width:220} },...actions.map(a=>{
    const d = depth(a), row = rows.get(d)||0; rows.set(d,row+1);
    return {id:a.actionId,position:{x:d*330,y:row*210},sourcePosition:Position.Right,targetPosition:Position.Left,data:{label:<div className="text-left space-y-2"><span className="text-xs text-sky-300">{a.agent} · {a.risk} risk · <span className={approvalState(a, approval).colour}>{approvalState(a, approval).label}</span></span><strong className="block">{a.title}</strong><p className="text-xs">{summary(a, budgets)}</p>{a.dependsOnActionIds.length > 0 && <p className="text-xs text-slate-400">Runs after {a.dependsOnActionIds.join(", ")}</p>}<label className="nodrag flex gap-2"><input type="checkbox" checked={selected.includes(a.actionId)} onChange={()=>toggle(a.actionId)} onClick={e=>e.stopPropagation()} /> Select for approval</label></div>},style:{width:280,background:selected.includes(a.actionId)?"#1e293b":"#0f172a",color:"white",border:"1px solid #38bdf8",borderRadius:12}};
  })] as Node[];
  }, [handoff, selected, budgets, approvalKey]);
  // React Flow drops a node's handle positions when it receives a fresh node object without `measured`, and edges
  // need those positions. The cockpit re-renders on every poll, so keep measured sizes across rebuilds.
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(built);
  useEffect(() => { setNodes(prev => built.map(n => ({ ...n, measured: prev.find(p => p.id === n.id)?.measured }))); }, [built, setNodes]);
  const edges: Edge[] = useMemo(() => actions.flatMap(a=>(a.dependsOnActionIds.length?a.dependsOnActionIds:["diagnosis"]).map(id=>({id:`${id}:${a.actionId}`,source:id,target:a.actionId}))), [actions]);
  return <div className="space-y-4"><div className="h-[580px] border border-slate-700 rounded-xl"><ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} defaultEdgeOptions={{style:{stroke:"#38bdf8",strokeWidth:2},markerEnd:{type:MarkerType.ArrowClosed,color:"#38bdf8"}}} fitView colorMode="dark" nodesDraggable={false} onNodeClick={(_,node)=>setFocused(actions.find(a=>a.actionId===node.id)||null)}><Background/><Controls/></ReactFlow></div>
    {focused && <aside className="rounded-xl bg-slate-900 border border-sky-700 p-5 space-y-3" aria-label="Action details"><button className="float-right" onClick={()=>setFocused(null)}>Close ×</button><h3 className="font-bold">{focused.title}</h3><p>{focused.rationale}</p><p className="text-sm text-sky-300">{summary(focused, budgets)}</p><p className="text-xs text-slate-400">Agent: {focused.agent} · tool {focused.actionType} · {approvalState(focused, approval).label}</p>{handoff.evidence.filter(e=>focused.evidenceIds.includes(e.evidenceId)).map(e=><p key={e.evidenceId} className="text-sm text-slate-400">{e.evidenceId}: {e.observedFact}</p>)}{focused.actionType==="customer.send_delay_notice" && <div className="whitespace-pre-line p-4 bg-slate-950 rounded"><h4>Approved email preview · {shippingDelayTemplate.subject}</h4>{shippingDelayTemplate.render("Customer", "order", shippingDelayTemplate.paragraph)}<p className="text-xs text-slate-400">Only the personalised paragraph may be drafted via Mubit; template fallback is recorded honestly.</p></div>}</aside>}
  </div>;
}

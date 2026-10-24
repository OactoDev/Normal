"use client";
import type { ExecutionSnapshot } from "../hooks/use-plan-executions";
type EmailResult = { key: string; orderId: string; to: string; provider: string; providerOperationId?: string; status: string; previewUrl?: string; modelUsed: string; body: string };
export function ExecutionResults({data}:{data:ExecutionSnapshot|null}) {
  if (!data?.executions.length) return <p className="text-slate-400">No tool read-backs yet.</p>;
  // Actions that never produced a tool result still belong in the audit view, with their real error.
  const withoutResult = data.executions.filter(e => !data.details.some(d => d.executionId === e.executionId));
  return <div className="space-y-5"><h2 className="text-xl font-bold">Verified tool results</h2>{data.details.map(d=>{
    const execution = data.executions.find(e=>e.executionId===d.executionId), outcome=data.outcomes.find(o=>o.executionId===d.executionId), p=d.payload;
    return <section key={d.executionId} className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-3"><h3 className="font-bold text-sky-400">{execution?.toolName} · {execution?.status}</h3><p>{outcome?.status}: {outcome?.summary}</p>
      {p.previousBudgetMinor!==undefined && <p>Budget read-back: {String(p.currency)} {(Number(p.previousBudgetMinor)/100).toFixed(2)} → {(Number(p.newBudgetMinor)/100).toFixed(2)}/day · <a className="text-sky-400" href="/ads">Open Ads Manager ↗</a></p>}
      {Array.isArray(p.emails) && (p.emails as EmailResult[]).map(original=>{const e=data.emailSends?.find(s=>s.key===original.key)||original;return <article key={e.key} className="bg-slate-950 p-4 rounded space-y-2 text-sm"><p>{e.orderId} → {e.to} (controlled test inbox)</p><p>{e.provider} · {e.providerOperationId} · <strong>{e.status}</strong></p><p>Draft: {e.modelUsed}</p><p className="whitespace-pre-line">{e.body}</p>{e.previewUrl && <a className="text-sky-400" target="_blank" rel="noreferrer" href={e.previewUrl}>Open Ethereal preview ↗</a>}<p className="text-slate-400">{e.status === "delivered" ? `${e.provider} reported this message delivered.` : "Accepted is not proof of inbox delivery; re-checked with the provider."}</p></article>;})}
      {p.after && <div><p>Banner configuration confirmed. <a href="/store" className="text-sky-400">Open store ↗</a></p><pre className="text-xs whitespace-pre-wrap mt-3">{JSON.stringify(p.readBack,null,2)}</pre></div>}
    </section>;
  })}{withoutResult.map(e=><section key={e.executionId} className="bg-slate-900 border border-red-900 rounded-xl p-5 space-y-2"><h3 className="font-bold text-sky-400">{e.toolName} · {e.status}</h3><p className="text-red-300">{e.error ? `${e.error.code}: ${e.error.message}` : "No tool result yet."}</p><p className="text-xs text-slate-400">No state change was verified for this action.</p></section>)}</div>;
}

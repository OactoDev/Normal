"use client";
import type { ExecutionSnapshot } from "../hooks/use-plan-executions";
export function ExecutionLog({ logs, executions }: {logs: ExecutionSnapshot["logs"]; executions: ExecutionSnapshot["executions"]}) {
  const actionFor = new Map(executions.map(e => [e.executionId, `${e.actionId} · ${e.toolName}`]));
  return <section className="bg-slate-50 border border-slate-200 p-5 rounded-xl"><h3 className="font-bold mb-3">Persisted execution log</h3><div className="max-h-80 overflow-auto font-mono text-xs space-y-2">{logs.map(l=><p key={l.logId}><span className="text-slate-500">{new Date(l.at).toLocaleTimeString()} · {actionFor.get(l.executionId) || l.executionId.slice(0,8)}</span> <span className="text-blue-600">{l.message}</span></p>)}</div></section>;
}

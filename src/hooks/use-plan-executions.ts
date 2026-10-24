"use client";
import { useEffect, useState, useCallback } from "react";
import type { orchestrator } from "../agents/orchestrator";
export type ExecutionSnapshot = Awaited<ReturnType<typeof orchestrator.snapshot>>;
export function usePlanExecutions(planId: string) {
  const [data, setData] = useState<ExecutionSnapshot | null>(null), [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const r = await fetch(`/api/plans/${encodeURIComponent(planId)}/executions`, { cache: "no-store" });
    const body = await r.json();
    if (!r.ok) throw new Error(body.error?.message || "Could not load executions");
    setData(body); setError(""); return body as ExecutionSnapshot;
  },[planId]);
  useEffect(() => {
    setData(null);
    let disposed = false, timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { if (!disposed) await refresh(); } catch (e) { if (!disposed) setError(String(e)); }
      if (!disposed) timer = setTimeout(poll,1000);
    };
    void poll(); return () => { disposed = true; clearTimeout(timer); };
  },[refresh]);
  return { data, error, refresh };
}

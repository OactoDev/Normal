"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, FlaskConical, LockKeyhole, ShieldCheck, AlertTriangle } from "lucide-react";
import type { EvidenceT, SaplingCheckT } from "../contracts";

const LABELS = ["supported", "violation", "insufficient_information", "inconsistent_context"];
const labelText = (label: string) => label.replaceAll("_", " ");
const percentage = (probability: number) => `${(probability * 100).toFixed(1)}%`;

type StressRow = Omit<SaplingCheckT, "evidenceIds"> & {
  id: string;
  title: string;
  expected: string;
  actual: string;
  matches: boolean;
};

export function SaplingPolicyGate({ check, evidence }: { check: SaplingCheckT; evidence: EvidenceT[] }) {
  const [barsReady, setBarsReady] = useState(false);
  const [stressRunning, setStressRunning] = useState(false);
  const [stress, setStress] = useState<{ results: StressRow[]; latencyMs: number } | null>(null);
  const [stressError, setStressError] = useState("");
  const live = check.status !== "unavailable" && check.status !== "not_called";
  const blocked = check.blocked;
  const cited = evidence.filter((item) => check.evidenceIds.includes(item.evidenceId));
  const verdictProbability = check.probabilities[check.verdict];

  useEffect(() => {
    setBarsReady(false);
    const timer = setTimeout(() => setBarsReady(true), 70);
    return () => clearTimeout(timer);
  }, [check]);

  async function runStressTest() {
    setStressRunning(true);
    setStress(null);
    setStressError("");
    try {
      const response = await fetch("/api/sapling/stress", { method: "POST" });
      if (!response.ok) throw new Error(`Live checks failed (HTTP ${response.status}).`);
      const result = await response.json();
      setStress(result);
    } catch (error) {
      setStressError(error instanceof Error ? error.message : "Could not complete the live checks.");
    } finally {
      setStressRunning(false);
    }
  }

  return (
    <section
      data-testid="sapling-policy-gate"
      aria-label="Sapling Policy Gate"
      className={`relative overflow-hidden rounded-xl border p-5 ${blocked ? "border-rose-500/35 bg-rose-950/15" : "border-emerald-500/30 bg-emerald-950/10"}`}
      style={{ backgroundImage: `radial-gradient(ellipse at 100% 0%, ${blocked ? "rgba(244,63,94,.08)" : "rgba(16,185,129,.08)"}, transparent 65%)` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`rounded-lg border p-2 ${blocked ? "border-rose-500/25 bg-rose-500/10 text-rose-300" : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"}`}>
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-base font-semibold tracking-tight text-white">Sapling Policy Gate</h4>
            <p className="mt-0.5 text-xs text-slate-400">Every diagnosis must earn the right to become a plan.</p>
          </div>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] ${live ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-amber-500/25 text-amber-300"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse bg-emerald-400" : "bg-amber-400"}`} />
          {live ? "LIVE" : "NOT VERIFIED"} · Banyan Sapling · {(check.latencyMs / 1000).toFixed(2)} s
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_0.85fr]">
        <GateTile step="01" title="Policy">{check.policy}</GateTile>
        <ArrowRight className="hidden h-4 w-4 self-center text-slate-600 md:block" />
        <GateTile step="02" title="Evidence">
          {cited.length ? cited.map((item) => <p key={item.evidenceId}>{item.observedFact}</p>) : check.evidenceIds.join(", ") || "No cited evidence."}
        </GateTile>
        <ArrowRight className="hidden h-4 w-4 self-center text-slate-600 md:block" />
        <GateTile step="03" title="Claim">{check.claim}</GateTile>
        <ArrowRight className="hidden h-4 w-4 self-center text-slate-600 md:block" />
        <div className={`flex flex-col items-center justify-center rounded-lg border px-3 py-4 text-center ${!live ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : blocked ? "border-rose-500/35 bg-rose-500/10 text-rose-300" : "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"}`}>
          {blocked ? <LockKeyhole className="mb-2 h-6 w-6" /> : <CheckCircle2 className="mb-2 h-6 w-6" />}
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Verdict</span>
          <strong data-testid="sapling-verdict" className="mt-1 text-base leading-tight">{labelText(check.verdict)}</strong>
          {verdictProbability !== undefined && <span className="mt-1 font-mono text-sm">{percentage(verdictProbability)}</span>}
        </div>
      </div>

      <div className="mt-4 grid gap-x-6 gap-y-2 md:grid-cols-2" aria-label="Sapling label probabilities">
        {Object.entries(check.probabilities).length ? Object.entries(check.probabilities).map(([label, value], index) => (
          <div key={label}>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className={label === check.rawLabel ? "font-semibold text-slate-200" : "text-slate-500"}>{labelText(label)}</span>
              <span className="font-mono text-slate-400">{percentage(value)}</span>
            </div>
            <div role="meter" aria-label={labelText(label)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value * 100} className="h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div className={`h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none ${label === "supported" ? "bg-emerald-400" : label === "violation" ? "bg-rose-400" : "bg-amber-400"}`} style={{ width: barsReady ? `${Math.max(0, Math.min(1, value)) * 100}%` : "0%", transitionDelay: `${index * 70}ms` }} />
            </div>
          </div>
        )) : <p className="text-xs text-amber-300">No live probability distribution available.</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-700/50 pt-3">
        <p className={`flex items-center gap-1.5 text-xs ${blocked ? "text-rose-300" : "text-emerald-300"}`}>
          {blocked ? <LockKeyhole className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          {blocked ? "Plan blocked · no money moves" : live ? "Policy gate passed · merchant approval still required" : "Live verification unavailable"}
        </p>
        <span className="font-mono text-[10px] text-slate-500">calibrated: {check.status} · raw: {check.rawLabel || "—"}</span>
      </div>
      {check.error && <p className="mt-2 text-xs text-amber-300">Sapling unavailable: {check.error}</p>}

      <div className="mt-4 border-t border-slate-700/50 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            data-testid="sapling-stress-button"
            onClick={runStressTest}
            disabled={stressRunning}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-emerald-500/60 hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
          >
            <FlaskConical className={`h-4 w-4 ${stressRunning ? "animate-pulse text-emerald-300" : "text-emerald-400"}`} />
            {stressRunning ? "Running 4 live checks…" : "Stress-test Sapling (4 live checks)"}
          </button>
          <span className="text-[11px] text-slate-500">4 cases tested in parallel · real API responses</span>
        </div>
        {stressRunning && (
          <div data-testid="sapling-stress-results" role="status" className="mt-3 space-y-2">
            {LABELS.map((label) => <div key={label} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400"><span>{labelText(label)}</span><span className="animate-pulse text-emerald-400">Checking live…</span></div>)}
          </div>
        )}
        {stressError && <p role="alert" className="mt-3 text-xs text-rose-300">{stressError}</p>}
        {stress && (
          <div data-testid="sapling-stress-results" className="mt-3 space-y-2" aria-live="polite">
            {stress.results.map((row) => {
              const top = Object.entries(row.probabilities).sort((a, b) => b[1] - a[1])[0];
              return (
                <div data-testid={`sapling-stress-row-${row.id}`} key={row.id} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2.5 md:grid-cols-[1.3fr_1fr_1.1fr_0.4fr] md:items-center">
                  <div className="flex items-center gap-2 text-xs text-slate-300">{row.matches ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />}<span>{row.title}</span></div>
                  <div className="text-[10px] text-slate-500">expected <span className="text-slate-300">{labelText(row.expected)}</span></div>
                  <div>
                    <div className="flex items-center justify-between gap-2 text-[11px]"><span className={row.actual === "supported" ? "text-emerald-300" : row.status === "unavailable" ? "text-amber-300" : "text-rose-300"}>{labelText(row.actual)}</span><span className="font-mono text-slate-400">{top ? percentage(top[1]) : "—"}</span></div>
                    <div className="mt-1 h-1 rounded-full bg-slate-800"><div className={`h-full rounded-full ${row.actual === "supported" ? "bg-emerald-400" : "bg-rose-400"}`} style={{ width: `${(top?.[1] || 0) * 100}%` }} /></div>
                  </div>
                  <div className="text-right font-mono text-[11px] text-slate-400">{(row.latencyMs / 1000).toFixed(2)} s</div>
                  {row.error && <p className="text-xs text-amber-300 md:col-span-4">{row.error}</p>}
                </div>
              );
            })}
            <p data-testid="sapling-stress-complete" className="pt-1 text-right font-mono text-[10px] text-slate-500">{stress.results.filter((row) => row.matches).length}/{stress.results.length} matched · wall time {(stress.latencyMs / 1000).toFixed(2)} s</p>
          </div>
        )}
      </div>
    </section>
  );
}

function GateTile({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-950/60 p-3">
      <div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</span><span className="font-mono text-[10px] text-slate-600">{step}</span></div>
      <div className="space-y-1 text-xs leading-relaxed text-slate-300">{children}</div>
    </div>
  );
}

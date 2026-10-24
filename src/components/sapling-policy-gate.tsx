"use client";

import { useState } from "react";
import { Check, ShieldCheck, ShieldX, X } from "lucide-react";
import type { EvidenceT, SaplingCheckT } from "../contracts";

const LABELS = ["supported", "violation", "insufficient_information", "inconsistent_context"];
const BAR: Record<string, string> = { supported: "bg-emerald-500", violation: "bg-red-500", insufficient_information: "bg-amber-400", inconsistent_context: "bg-violet-500" };
const TEXT: Record<string, string> = { supported: "text-emerald-700", violation: "text-red-600", insufficient_information: "text-amber-700", inconsistent_context: "text-violet-700", unsure: "text-amber-700" };
const labelText = (label: string) => label.replaceAll("_", " ");
const capitalised = (label: string) => labelText(label).replace(/^./, (c) => c.toUpperCase());
const percentage = (probability: number) => `${(probability * 100).toFixed(1)}%`;

type StressRow = Omit<SaplingCheckT, "evidenceIds"> & {
  id: string;
  title: string;
  expected: string;
  actual: string;
  matches: boolean;
};

export function SaplingPolicyGate({ check, evidence }: { check: SaplingCheckT; evidence: EvidenceT[] }) {
  const [stressRunning, setStressRunning] = useState(false);
  const [stress, setStress] = useState<{ results: StressRow[]; latencyMs: number } | null>(null);
  const [stressError, setStressError] = useState("");
  const live = check.status !== "unavailable" && check.status !== "not_called";
  const cited = evidence.filter((item) => check.evidenceIds.includes(item.evidenceId));
  const labels = LABELS.filter((label) => check.probabilities[label] !== undefined);
  const confidence = check.probabilities[check.verdict];

  async function runStressTest() {
    setStressRunning(true);
    setStress(null);
    setStressError("");
    try {
      const response = await fetch("/api/sapling/stress", { method: "POST" });
      if (!response.ok) throw new Error(`Checks failed (HTTP ${response.status}).`);
      setStress(await response.json());
    } catch (error) {
      setStressError(error instanceof Error ? error.message : "Could not run the checks.");
    } finally {
      setStressRunning(false);
    }
  }

  return (
    <section data-testid="sapling-policy-gate" aria-label="Banyan Sapling check" className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h4 className="text-sm font-semibold text-slate-900">Banyan Sapling verification</h4>
        <span className="text-xs text-slate-500">{live ? `Sapling API · ${check.latencyMs.toLocaleString()} ms` : "Not verified"}</span>
      </div>

      <div className="space-y-5 p-5">
        <div className={`flex items-center gap-4 rounded-lg border px-4 py-3 ${check.blocked ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
          {check.blocked ? <ShieldX className="h-6 w-6 shrink-0 text-red-600" /> : <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-600" />}
          <div className="min-w-0">
            <p data-testid="sapling-verdict" className={`text-lg font-semibold leading-tight ${TEXT[check.verdict] || "text-slate-900"}`}>{capitalised(check.verdict)}</p>
            <p className="text-sm text-slate-600">{check.blocked ? "Plan blocked. Nothing can be spent on this diagnosis." : "Plan sent to the merchant for approval."}</p>
          </div>
          {confidence !== undefined && (
            <div className="ml-auto text-right">
              <p className="text-2xl font-semibold tabular-nums text-slate-900">{percentage(confidence)}</p>
              <p className="text-xs text-slate-500">confidence</p>
            </div>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Input title="Policy">{check.policy}</Input>
          <Input title="Evidence">{cited.length ? cited.map((item) => <p key={item.evidenceId}>{item.observedFact}</p>) : check.evidenceIds.join(", ") || "None cited"}</Input>
          <Input title="Claim">{check.claim}</Input>
        </div>

        {labels.length > 0 && (
          <div className="space-y-2" aria-label="Sapling label probabilities">
            <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
              {labels.map((label) => <div key={label} className={BAR[label]} style={{ width: `${Math.max(0, Math.min(1, check.probabilities[label])) * 100}%` }} />)}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
              {labels.map((label) => (
                <span key={label} className={`flex items-center gap-1.5 ${label === check.verdict ? "font-semibold text-slate-900" : "text-slate-500"}`}>
                  <span className={`h-2 w-2 rounded-full ${BAR[label]}`} />
                  {capitalised(label)} <span className="tabular-nums">{percentage(check.probabilities[label])}</span>
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-500">Calibrated status: {check.status}. We gate on Sapling&apos;s top label ({check.rawLabel ? labelText(check.rawLabel) : "none"}).</p>
          </div>
        )}
        {check.error && <p className="text-sm text-amber-700">Sapling unavailable: {check.error}</p>}
      </div>

      <div className="border-t border-slate-200 p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h5 className="text-sm font-semibold text-slate-900">Test cases</h5>
            <p className="text-xs text-slate-500">Four fixed inputs against the same policy, sent to Sapling in parallel.</p>
          </div>
          <button
            type="button"
            data-testid="sapling-stress-button"
            onClick={runStressTest}
            disabled={stressRunning}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            {stressRunning ? "Running…" : "Run 4 test cases"}
          </button>
        </div>
        {stressError && <p role="alert" className="text-sm text-red-600">{stressError}</p>}
        {(stressRunning || stress) && (
          <table data-testid="sapling-stress-results" className="w-full text-sm" aria-live="polite">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 font-medium">Case</th>
                <th className="py-2 font-medium">Expected</th>
                <th className="py-2 font-medium">Sapling result</th>
                <th className="py-2 font-medium">Match</th>
                <th className="py-2 text-right font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stress
                ? stress.results.map((row) => {
                    const top = Object.values(row.probabilities).sort((a, b) => b - a)[0];
                    return (
                      <tr data-testid={`sapling-stress-row-${row.id}`} key={row.id} className="hover:bg-slate-50">
                        <td className="py-2.5 text-slate-800">{row.title}</td>
                        <td className="py-2.5 text-slate-500">{capitalised(row.expected)}</td>
                        <td className="py-2.5">
                          <span className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${BAR[row.actual] || "bg-amber-400"}`} />
                            <span className={TEXT[row.actual] || "text-slate-700"}>{capitalised(row.actual)}</span>
                            {top !== undefined && <span className="tabular-nums text-slate-500">{percentage(top)}</span>}
                          </span>
                          {row.error && <span className="block text-xs text-amber-700">{row.error}</span>}
                        </td>
                        <td className="py-2.5">{row.matches ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-red-600" />}</td>
                        <td className="py-2.5 text-right tabular-nums text-slate-500">{row.latencyMs.toLocaleString()} ms</td>
                      </tr>
                    );
                  })
                : LABELS.map((label) => (
                    <tr key={label}>
                      <td colSpan={5} className="py-2.5"><div className="h-4 w-full animate-pulse rounded bg-slate-100" /></td>
                    </tr>
                  ))}
            </tbody>
          </table>
        )}
        {stress && (
          <p data-testid="sapling-stress-complete" className="text-xs text-slate-500">
            {stress.results.filter((row) => row.matches).length}/{stress.results.length} match · {(stress.latencyMs / 1000).toFixed(1)} s total
          </p>
        )}
      </div>
    </section>
  );
}

function Input({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="mb-1 text-xs font-medium text-slate-500">{title}</p>
      <div className="space-y-1 text-sm text-slate-800">{children}</div>
    </div>
  );
}

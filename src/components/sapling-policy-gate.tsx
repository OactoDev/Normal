"use client";

import { useState } from "react";
import type { EvidenceT, SaplingCheckT } from "../contracts";

const LABELS = ["supported", "violation", "insufficient_information", "inconsistent_context"];
const labelText = (label: string) => label.replaceAll("_", " ");
const percentage = (probability: number) => `${(probability * 100).toFixed(1)}%`;
const verdictColor = (label: string) => (label === "supported" ? "text-emerald-400" : label === "unsure" ? "text-amber-400" : "text-rose-400");

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
  const probabilities = LABELS.filter((label) => check.probabilities[label] !== undefined);

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
    <section data-testid="sapling-policy-gate" aria-label="Banyan Sapling check" className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-sm font-semibold text-slate-200">Banyan Sapling check</h4>
        <span className="text-xs text-slate-500">
          {live ? `Sapling API · ${check.latencyMs} ms` : "Not verified"}
        </span>
      </div>

      <dl className="grid grid-cols-[80px_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-slate-500">Policy</dt>
        <dd className="text-slate-300">{check.policy}</dd>
        <dt className="text-slate-500">Evidence</dt>
        <dd className="text-slate-300">
          {cited.length ? cited.map((item) => <p key={item.evidenceId}>{item.observedFact}</p>) : check.evidenceIds.join(", ") || "None cited"}
        </dd>
        <dt className="text-slate-500">Claim</dt>
        <dd className="text-slate-300">{check.claim}</dd>
        <dt className="text-slate-500">Verdict</dt>
        <dd>
          <span data-testid="sapling-verdict" className={`font-semibold ${verdictColor(check.verdict)}`}>{labelText(check.verdict)}</span>
          {check.probabilities[check.verdict] !== undefined && (
            <span className="text-slate-400"> · {percentage(check.probabilities[check.verdict])}</span>
          )}
          <span className="text-slate-500">
            {" "}· {check.blocked ? "plan blocked" : "plan allowed, pending merchant approval"}
          </span>
        </dd>
      </dl>

      {probabilities.length > 0 && (
        <table className="w-full text-xs" aria-label="Sapling label probabilities">
          <tbody>
            {probabilities.map((label) => {
              const value = check.probabilities[label];
              return (
                <tr key={label}>
                  <td className={`w-48 py-0.5 ${label === check.verdict ? "text-slate-200" : "text-slate-500"}`}>{labelText(label)}</td>
                  <td className="py-0.5">
                    <div className="h-1 rounded bg-slate-800">
                      <div className={`h-full rounded ${label === check.verdict ? (check.blocked ? "bg-rose-500" : "bg-emerald-500") : "bg-slate-600"}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
                    </div>
                  </td>
                  <td className="w-14 py-0.5 text-right tabular-nums text-slate-400">{percentage(value)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="text-xs text-slate-500">Calibrated status: {check.status} · top label: {check.rawLabel || "none"}</p>
      {check.error && <p className="text-xs text-amber-400">Sapling unavailable: {check.error}</p>}

      <div className="border-t border-slate-800 pt-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">Run four fixed cases against the same policy.</p>
          <button
            type="button"
            data-testid="sapling-stress-button"
            onClick={runStressTest}
            disabled={stressRunning}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-60"
          >
            {stressRunning ? "Checking…" : "Run test cases"}
          </button>
        </div>
        {stressError && <p role="alert" className="text-xs text-rose-400">{stressError}</p>}
        {(stressRunning || stress) && (
          <table data-testid="sapling-stress-results" className="w-full text-xs" aria-live="polite">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="pb-2 font-normal">Case</th>
                <th className="pb-2 font-normal">Expected</th>
                <th className="pb-2 font-normal">Sapling</th>
                <th className="pb-2 text-right font-normal">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {stress
                ? stress.results.map((row) => {
                    const top = Object.values(row.probabilities).sort((a, b) => b - a)[0];
                    return (
                      <tr data-testid={`sapling-stress-row-${row.id}`} key={row.id}>
                        <td className="py-2 text-slate-300">{row.title}</td>
                        <td className="py-2 text-slate-500">{labelText(row.expected)}</td>
                        <td className={`py-2 ${verdictColor(row.actual)}`}>
                          {labelText(row.actual)}{top !== undefined && <span className="text-slate-500"> · {percentage(top)}</span>}
                          {row.error && <span className="block text-amber-400">{row.error}</span>}
                        </td>
                        <td className="py-2 text-right tabular-nums text-slate-500">{row.latencyMs} ms</td>
                      </tr>
                    );
                  })
                : LABELS.map((label) => (
                    <tr key={label}>
                      <td className="py-2 text-slate-500" colSpan={4}>Checking {labelText(label)} case…</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        )}
        {stress && (
          <p data-testid="sapling-stress-complete" className="text-xs text-slate-500">
            {stress.results.filter((row) => row.matches).length} of {stress.results.length} match the expected verdict · {stress.latencyMs} ms total
          </p>
        )}
      </div>
    </section>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  AlertTriangle,
  Cpu,
  RefreshCw,
  Send,
  Zap,
  Sliders,
  CheckCircle2,
  Clock,
  ArrowRight,
  GraduationCap,
} from "lucide-react";

import { RootCause } from "../contracts";
import { SaplingPolicyGate } from "./sapling-policy-gate";

interface IntelligencePanelProps {
  onPlanGenerated: (planId: string) => void;
}

export function IntelligencePanel({ onPlanGenerated }: IntelligencePanelProps) {
  const [scenario, setScenario] = useState("delivery_delays");
  const [severity, setSeverity] = useState(0.85);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const [simData, setSimData] = useState<any>(null);
  const [diagnosisData, setDiagnosisData] = useState<any>(null);
  const [modelCall, setModelCall] = useState<any>(null);
  const [diagnosisError, setDiagnosisError] = useState("");
  const [correctionCause, setCorrectionCause] = useState("delivery_delays");
  const [correctionNote, setCorrectionNote] = useState("");
  const [feedbackResult, setFeedbackResult] = useState<any>(null);
  const [feedbackError, setFeedbackError] = useState("");
  const [learning, setLearning] = useState<any>(null);
  // The diagnosis a merchant corrected, kept so the next Mubit call can be compared with it.
  const [correctedRun, setCorrectedRun] = useState<{ cause: string; requestId?: string } | null>(null);
  const [planBlock, setPlanBlock] = useState<any>(null);

  // Load initial simulation and Mubit learning status on mount
  useEffect(() => {
    fetchSimulationState();
    fetchLearning();
  }, []);

  const fetchSimulationState = async () => {
    try {
      const res = await fetch("/api/intelligence/scenarios");
      if (res.ok) {
        const data = await res.json();
        setSimData(data);
      }
    } catch (e) {
      console.error("Error fetching simulation:", e);
    }
  };

  const fetchLearning = async () => {
    try {
      const res = await fetch("/api/intelligence/feedback");
      if (res.ok) setLearning(await res.json());
    } catch (e) {
      console.error("Error fetching Mubit learning status:", e);
    }
  };

  const handleSimulate = async (nextSeverity = severity, nextScenario = scenario) => {
    setSeverity(nextSeverity);
    setScenario(nextScenario);
    setIsSimulating(true);
    setDiagnosisError("");
    try {
      const res = await fetch("/api/intelligence/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: nextScenario, severity: nextSeverity }),
      });
      if (res.ok) {
        const data = await res.json();
        setSimData(data);
        setDiagnosisData(null);
        setModelCall(null);
        setPlanBlock(null);
      }
    } catch (e) {
      console.error("Simulation error:", e);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleDiagnose = async () => {
    setIsDiagnosing(true);
    setDiagnosisError("");
    setDiagnosisData(null);
    setModelCall(null);
    setPlanBlock(null);
    try {
      const res = await fetch("/api/intelligence/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investigation: simData?.investigation,
          evidence: simData?.evidence,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "The AI diagnosis could not be completed. Please retry.");
      if (res.ok) {
        setDiagnosisData(data.diagnosis);
        setModelCall(data.modelCall);
        setFeedbackResult(null);
        fetchLearning();
        setPlanBlock(null);
        if (data.diagnosis?.output?.primaryCause) {
          setCorrectionCause(data.diagnosis.output.primaryCause);
        }
      }
    } catch (e) {
      setDiagnosisError(e instanceof Error ? e.message : "The AI diagnosis could not be completed. Please retry.");
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleGeneratePlan = async () => {
    if (!diagnosisData) return;
    setIsGeneratingPlan(true);
    try {
      const res = await fetch("/api/intelligence/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnosis: diagnosisData,
          evidence: simData?.evidence || [],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onPlanGenerated(data.planId);
      } else if (res.status === 409) {
        const data = await res.json();
        setPlanBlock(data.saplingCheck);
      }
    } catch (e) {
      console.error("Plan generation error:", e);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!diagnosisData || !modelCall) return;
    setIsSubmittingFeedback(true);
    setFeedbackError("");
    try {
      const evidence = simData?.evidence || [];
      const res = await fetch("/api/intelligence/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investigationId: diagnosisData.investigationId,
          diagnosisId: diagnosisData.diagnosisId,
          modelCallId: modelCall.modelCallId,
          mubitRequestId: modelCall.mubitRequestId,
          predictedCause: diagnosisData.output.primaryCause,
          correctedCause: correctionCause,
          correctedEvidenceIds: evidence.map((e: any) => e.evidenceId),
          evidence,
          ...(correctionNote.trim() ? { note: correctionNote.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "The correction could not be saved.");
      setFeedbackResult(data);
      setLearning(data);
      setCorrectedRun({ cause: diagnosisData.output.primaryCause, requestId: modelCall.mubitRequestId });
    } catch (e) {
      setFeedbackError(e instanceof Error ? e.message : "The correction could not be saved.");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleResetCorrections = async () => {
    try {
      const res = await fetch("/api/intelligence/feedback", { method: "DELETE" });
      if (res.ok) setLearning(await res.json());
      setFeedbackResult(null);
      setCorrectedRun(null);
    } catch (e) {
      console.error("Reset corrections error:", e);
    }
  };

  const saplingCheck = planBlock || diagnosisData?.serverAttribution?.saplingCheck;

  return (
    <div className="space-y-6">
      {/* Module Overview Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Cpu className="w-3.5 h-3.5" /> Intelligence Backend Active
              </span>
              <span className="text-xs text-slate-500">Mubit Proxy: gemini-4-argon</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">Autonomous Detection & Diagnosis Studio</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Simulates live business telemetry, identifies anomalies, runs Mubit AI diagnosis, and feeds approved actions into execution.
            </p>
          </div>
          <button
            onClick={fetchSimulationState}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-medium self-start md:self-auto transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh State
          </button>
        </div>
      </div>

      {/* Grid: Simulator & Investigation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Step 1: Telemetry Simulation */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Sliders className="w-4 h-4 text-blue-600" /> 1. Telemetry Simulator
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Events: {simData?.eventsCount || 0}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Operational Scenario
              </label>
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="delivery_delays">delivery_delays (Shipping SLA breach & reviews)</option>
                <option value="ad_fatigue">ad_fatigue (CAC spike & CTR drop)</option>
                <option value="promo_checkout_failure">promo_checkout_failure (Coupon timeouts)</option>
                <option value="negative_reviews">negative_reviews (Product sentiment drop)</option>
                <option value="viral_demand">viral_demand (Rapid sales & low inventory)</option>
                <option value="healthy">healthy (Normal baseline traffic)</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Scenario Severity</span>
                <span className="font-mono">{Math.round(severity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={severity}
                onChange={(e) => setSeverity(parseFloat(e.target.value))}
                className="w-full accent-sky-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2" aria-label="Delivery policy scenarios">
              <button type="button" data-testid="sapling-scenario-supported" onClick={() => handleSimulate(0.85, "delivery_delays")} disabled={isSimulating || isDiagnosing} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50">14 late orders</button>
              <button type="button" data-testid="sapling-scenario-blocked" onClick={() => handleSimulate(0.15, "delivery_delays")} disabled={isSimulating || isDiagnosing} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50">8 late orders</button>
            </div>

            <button
              onClick={() => handleSimulate()}
              disabled={isSimulating || isDiagnosing}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-600 disabled:opacity-50 text-white font-medium text-sm transition-colors"
            >
              <Activity className={`w-4 h-4 ${isSimulating ? "animate-spin" : ""}`} />
              {isSimulating ? "Injecting Telemetry..." : "Inject Scenario & Simulate Telemetry"}
            </button>
          </div>

          {/* Active Anomalies */}
          <div className="pt-2 border-t border-slate-200">
            <span className="text-xs font-semibold text-slate-500 block mb-2">
              Detected Anomalies ({simData?.anomalies?.length || 0})
            </span>
            {simData?.anomalies?.length > 0 ? (
              <div className="space-y-1.5">
                {simData.anomalies.map((anom: any) => (
                  <div
                    key={anom.anomalyId}
                    className="flex items-center justify-between p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                      <span className="font-mono text-amber-700">{anom.metric}</span>
                    </div>
                    <span className="text-amber-700 font-mono">
                      severity: {anom.severity}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic p-2 bg-slate-50 rounded-lg">
                No active anomalies. Inject a failure scenario above.
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Investigation & Assembled Evidence */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Zap className="w-4 h-4 text-emerald-700" /> 2. Investigation & Evidence
            </div>
            <span className="text-xs font-mono text-slate-500">
              {simData?.investigation?.investigationId || "inv_pending"}
            </span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {simData?.evidence?.length > 0 ? (
              simData.evidence.map((ev: any) => (
                <div
                  key={ev.evidenceId}
                  className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-slate-500 font-mono text-[11px]">
                    <span className="text-emerald-700 font-semibold">{ev.evidenceId}</span>
                    <span>{new Date(ev.retrievedAt).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-slate-700 font-sans">{ev.observedFact}</p>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg">
                Run telemetry simulation to assemble evidence facts.
              </div>
            )}
          </div>

          <button
            onClick={handleDiagnose}
            disabled={isDiagnosing || !simData?.evidence?.length}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm transition-colors"
          >
            <Cpu className={`w-4 h-4 ${isDiagnosing ? "animate-spin" : ""}`} />
            {isDiagnosing ? "Running AI Diagnosis via Mubit..." : "Run Mubit AI Diagnosis"}
          </button>
          {diagnosisError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{diagnosisError}</p>}
        </div>
      </div>

      {/* Step 3: Diagnosis Results & Human Feedback */}
      {diagnosisData && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">3. Mubit AI Diagnosis Result</h3>
            </div>
            {modelCall && (
              <div className="flex items-center gap-3 text-xs font-mono text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" /> {modelCall.latencyMs}ms
                </span>
                <span className="text-blue-600" data-testid="mubit-request-id">Mubit request: {modelCall.mubitRequestId}</span>
              </div>
            )}
          </div>

          {modelCall && (
            <div data-testid="corrections-applied" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {modelCall.appliedCorrectionIds?.length
                ? <>This Mubit call included <b>{modelCall.appliedCorrectionIds.length}</b> merchant-verified correction{modelCall.appliedCorrectionIds.length === 1 ? " as a labelled example" : "s as labelled examples"} (same Mubit task, same system prompt).</>
                : <>No merchant corrections were included in this Mubit call.</>}
              {correctedRun && modelCall.mubitRequestId !== correctedRun.requestId && (
                <span data-testid="correction-before-after" className="block mt-1 font-mono text-[11px]">
                  Before correction: <b>{correctedRun.cause}</b> ({correctedRun.requestId}) <ArrowRight className="inline w-3 h-3" /> after: <b className={diagnosisData.output.primaryCause === correctedRun.cause ? "text-amber-700" : "text-emerald-700"}>{diagnosisData.output.primaryCause}</b> ({modelCall.mubitRequestId})
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 uppercase font-semibold">Primary Cause</span>
              <p className="text-base font-bold text-blue-600 mt-0.5">
                {diagnosisData.output.primaryCause}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 uppercase font-semibold">Model Provider</span>
              <p className="text-base font-medium text-slate-800 mt-0.5">
                {modelCall?.providerModel || "gemini-4-argon (Mubit)"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 uppercase font-semibold">Banyan Sapling</span>
              {saplingCheck && saplingCheck.status !== "unavailable" ? (
                <>
                  <p className={`text-base font-bold mt-0.5 ${saplingCheck.blocked ? "text-red-600" : "text-emerald-700"}`}>
                    {saplingCheck.verdict}
                    {saplingCheck.probabilities?.[saplingCheck.verdict] !== undefined &&
                      ` · ${Math.round(saplingCheck.probabilities[saplingCheck.verdict] * 100)}%`}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    calibrated: {saplingCheck.status} · {saplingCheck.latencyMs}ms
                  </p>
                </>
              ) : (
                <p className="text-base font-medium text-amber-700 mt-0.5">not verified</p>
              )}
            </div>
          </div>

          {saplingCheck && <SaplingPolicyGate check={saplingCheck} evidence={simData?.evidence || []} />}

          {/* Action Row: Generate Plan or Correct */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
            {/* Direct Plan Generator */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <h4 className="text-xs font-semibold text-slate-700 uppercase">
                Accept & Proceed to Orchestration
              </h4>
              <p className="text-xs text-slate-500">
                Synthesize actionable recovery operations based on this diagnosis and dispatch to Aman&apos;s execution cockpit.
              </p>
              <button
                data-testid="sapling-plan-button"
                title={saplingCheck?.blocked ? "Banyan Sapling blocked this diagnosis. No plan can be generated." : "Build a plan for merchant approval"}
                onClick={handleGeneratePlan}
                disabled={isGeneratingPlan || saplingCheck?.blocked}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-600 disabled:opacity-50 text-white font-medium text-xs transition-colors"
              >
                {saplingCheck?.blocked ? "Blocked by Banyan Sapling" : isGeneratingPlan ? "Generating Plan..." : "Synthesize Plan & Open Operations"}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Merchant correction: becomes a labelled example in later Mubit calls of this task */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <h4 className="text-xs font-semibold text-amber-700 uppercase">
                Correct the diagnosis (teaches the next Mubit call)
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <select
                  data-testid="correction-cause"
                  value={correctionCause}
                  onChange={(e) => setCorrectionCause(e.target.value)}
                  className="bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-800"
                >
                  {RootCause.options.map((cause) => (
                    <option key={cause} value={cause}>{cause}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Why? (optional note)"
                  value={correctionNote}
                  onChange={(e) => setCorrectionNote(e.target.value)}
                  className="bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-800"
                />
              </div>
              <button
                data-testid="correction-submit"
                onClick={handleSubmitFeedback}
                disabled={isSubmittingFeedback}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium text-xs transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                {isSubmittingFeedback ? "Saving correction..." : "Save verified root cause"}
              </button>
              {feedbackError && <p role="alert" className="text-[11px] text-red-700">{feedbackError}</p>}
              {feedbackResult && (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] text-emerald-700 flex items-start gap-1">
                    <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>Saved as a local correction record. The next diagnosis sends it to Mubit as a labelled example.</span>
                  </p>
                  <button
                    data-testid="correction-rerun"
                    onClick={handleDiagnose}
                    disabled={isDiagnosing}
                    className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50 disabled:opacity-50 font-medium text-xs transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosing ? "animate-spin" : ""}`} />
                    {isDiagnosing ? "Re-running via Mubit..." : "Re-run diagnosis with this correction"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Mubit learning loop (only what Normal can actually observe) */}
      {learning && (
        <div data-testid="mubit-learning" className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-violet-600" />
              <h3 className="text-sm font-semibold text-slate-900">4. Mubit Learning Loop</h3>
            </div>
            {learning.corrections?.length > 0 && (
              <button onClick={handleResetCorrections} className="text-xs text-slate-500 hover:text-slate-800 underline">
                Clear corrections
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 uppercase font-semibold">Mubit task</span>
              <p className="mt-1 text-slate-800">&ldquo;{learning.mubitTask.consoleName}&hellip;&rdquo;</p>
              <p className="mt-1 font-mono text-[11px] text-slate-500">{learning.mubitTask.model} · {learning.mubitTask.fingerprint}</p>
              <p className="mt-1 text-[11px] text-slate-500">Every diagnosis, corrected or not, uses this one system prompt, model and output format, so Mubit records them as one task.</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 uppercase font-semibold">Merchant corrections</span>
              <p className="mt-1 text-lg font-bold text-slate-900 font-mono" data-testid="corrections-count">{learning.corrections?.length || 0}</p>
              <p className="text-[11px] text-slate-500">{learning.nextDiagnosisCorrectionIds?.length || 0} will be included in the next diagnosis call.</p>
              {modelCall && <p className="text-[11px] text-slate-500">Last call ({modelCall.mubitRequestId}) included {modelCall.appliedCorrectionIds?.length || 0}.</p>}
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 uppercase font-semibold">Adapter</span>
              <p className="mt-1 text-slate-800">Mubit trains an adapter for this task from its kept examples ({learning.mubitTask.defaultKeptExamplesToTrain} by default).</p>
              <p className="mt-1 text-[11px] text-slate-500">Kept-example count and adapter status are shown only in the {learning.mubitTask.adapterStatusSource}; Normal does not report them.</p>
            </div>
          </div>

          {learning.corrections?.length > 0 && (
            <ul className="space-y-1 text-[11px] font-mono text-slate-600">
              {learning.corrections.slice(0, 5).map((record: any) => (
                <li key={record.correction.correctionId}>
                  {record.correction.predictedCause} <ArrowRight className="inline w-3 h-3" /> <b>{record.correction.correctedCause}</b>
                  {record.correctedMubitRequestId && <> · corrected {record.correctedMubitRequestId}</>}
                  {record.correction.note && <> · &ldquo;{record.correction.note}&rdquo;</>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

import { DiagnosisModelOutputT, EvidenceT, RootCauseT, SaplingCheckT, SaplingLabelT } from "../contracts";

// Banyan Sapling (MubitLabs) — verifies a claim against a policy and evidence. No auth.
const SAPLING_URL = process.env.SAPLING_URL || "https://6adbee0669a00298cd4774c9.endpoints.huggingface.cloud";

// Sapling's calibrated `status` is conservative and returns `unsure` on most inputs.
// When it is unsure we gate on the raw (top) label; the calibrated status is kept for display.
const BLOCKING: SaplingLabelT[] = ["violation", "insufficient_information", "inconsistent_context"];

// The merchant's diagnosis policy: what evidence a root cause needs before spend can follow.
export const DIAGNOSIS_POLICY: Record<RootCauseT, string> = {
  delivery_delays: "A diagnosis may name delivery delays as the root cause only if at least 10 orders breached the delivery promise.",
  ad_fatigue: "A diagnosis may name ad fatigue as the root cause only if the campaign's customer acquisition cost (CAC) increased by more than 50%.",
  ad_inefficiency: "A diagnosis may name ad inefficiency as the root cause only if the campaign's customer acquisition cost (CAC) increased by more than 50%.",
  checkout_failure: "A diagnosis may name checkout failure as the root cause only if the checkout failure rate is above 5%.",
  negative_sentiment: "A diagnosis may name negative sentiment as the root cause only if at least 10 new low-rating reviews were received.",
  product_quality: "A diagnosis may name product quality as the root cause only if the evidence shows defect reports or quality-related returns.",
  discount_failure: "A diagnosis may name discount failure as the root cause only if the evidence shows discount or coupon errors.",
  stockout: "A diagnosis may name a stockout as the root cause only if the evidence shows products out of stock.",
  viral_demand: "A diagnosis may name viral demand as the root cause only if the evidence shows a sudden rise in traffic or orders.",
  seasonality: "A diagnosis may name seasonality as the root cause only if the evidence shows a matching seasonal pattern.",
  unknown: "A diagnosis must name a specific root cause supported by the evidence before any recovery plan is generated.",
};

const CAUSE_LABEL: Record<RootCauseT, string> = {
  delivery_delays: "delivery delays",
  ad_fatigue: "ad fatigue",
  ad_inefficiency: "ad inefficiency",
  checkout_failure: "checkout failure",
  negative_sentiment: "negative sentiment",
  product_quality: "product quality",
  discount_failure: "discount failure",
  stockout: "a stockout",
  viral_demand: "viral demand",
  seasonality: "seasonality",
  unknown: "an unknown cause",
};

export function renderEvidence(evidence: EvidenceT[]): string {
  return evidence
    .map((e) => {
      const m = Object.entries(e.measurements).map(([k, v]) => `${k}: ${v}`).join(", ");
      return `[${e.evidenceId}] ${e.observedFact}${m ? ` (${m})` : ""}`;
    })
    .join("\n");
}

// Pure decision rule, kept separate from the HTTP call so it can be tested offline.
export function decide(status: string, rawLabel: string): { verdict: SaplingLabelT; blocked: boolean } {
  const verdict = (status !== "unsure" ? status : rawLabel) as SaplingLabelT;
  return { verdict, blocked: BLOCKING.includes(verdict) };
}

export class SaplingBlockedError extends Error {
  constructor(public readonly check: SaplingCheckT) {
    super(`Banyan Sapling blocked this plan: diagnosis verdict is ${check.verdict}.`);
    this.name = "SaplingBlockedError";
  }
}

export class SaplingVerifier {
  public async verifyDiagnosis(output: DiagnosisModelOutputT, evidence: EvidenceT[]): Promise<SaplingCheckT> {
    const cause = output.primaryCause;
    const cited = output.supportedHypotheses.find((h) => h.cause === cause)?.evidenceIds ?? [];
    const used = evidence.filter((e) => cited.includes(e.evidenceId));
    const evidenceUsed = used.length > 0 ? used : evidence;

    const policy = DIAGNOSIS_POLICY[cause];
    const claim = `The diagnosis names ${CAUSE_LABEL[cause]} as the root cause.`;
    const base = { policy, claim, evidenceIds: evidenceUsed.map((e) => e.evidenceId) };

    if (cause === "unknown" || evidenceUsed.length === 0) {
      return { ...base, verdict: "insufficient_information", blocked: true, status: "not_called", rawLabel: "insufficient_information", probabilities: {}, latencyMs: 0 };
    }

    const started = Date.now();
    try {
      const response = await fetch(SAPLING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: { policy, evidence: renderEvidence(evidenceUsed), claim } }),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`Sapling HTTP ${response.status}`);
      const data = await response.json();
      const probabilities: Record<string, number> = data.probabilities || {};
      const { verdict, blocked } = decide(String(data.status), String(data.raw_label));
      return { ...base, verdict, blocked, status: String(data.status), rawLabel: String(data.raw_label), probabilities, latencyMs: Date.now() - started };
    } catch (err: any) {
      // Sapling unreachable: never claim a verification that didn't happen. The plan still needs human approval.
      return { ...base, verdict: "unsure", blocked: false, status: "unavailable", rawLabel: "", probabilities: {}, latencyMs: Date.now() - started, error: String(err?.message || err) };
    }
  }
}

export const saplingVerifier = new SaplingVerifier();

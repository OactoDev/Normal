import { PlanHandoff, PlanHandoffT } from "../contracts";
import { ToolError } from "../execution/retry-policy";
import { PartnerPlanHandoff } from "./normal-contracts";

// Their contracts grade hypotheses (weak/moderate/strong); ours score them. These are fixed band midpoints, not
// model confidences: the original grade is kept in `strength` and the UI shows the grade when it is present.
const STRENGTH_CONFIDENCE = { weak: 0.3, moderate: 0.6, strong: 0.85 } as const;

/** Their DateTime accepts offsets (`+01:00`); ours requires UTC `Z`. Same instant either way. */
const utc = (value: string) => new Date(value).toISOString();
const PLAN_DATES = ["createdAt", "expiresAt"] as const;
const PARAM_DATES = ["startsAt", "expiresAt"] as const;

/** Converts a PlanHandoff from the intelligence team's `@normal/contracts` into this module's PlanHandoff. */
export function fromPartnerHandoff(input: unknown): PlanHandoffT {
  const { plan, diagnosis, evidence } = PartnerPlanHandoff.parse(input);
  const normalisedPlan: Record<string, unknown> = { ...plan };
  for (const key of PLAN_DATES) if (typeof plan[key] === "string") normalisedPlan[key] = utc(plan[key] as string);
  if (Array.isArray(plan.actions)) normalisedPlan.actions = plan.actions.map((action: any) => {
    const params = { ...action?.params };
    for (const key of PARAM_DATES) if (typeof params[key] === "string") params[key] = utc(params[key]);
    return { ...action, params };
  });
  return PlanHandoff.parse({
    plan: normalisedPlan,
    diagnosis: {
      schemaVersion: 1,
      diagnosisId: diagnosis.diagnosisId,
      investigationId: diagnosis.investigationId,
      modelCallId: diagnosis.modelCallId,
      output: {
        primaryCause: diagnosis.primaryCause,
        supportedHypotheses: diagnosis.hypotheses.map(h => ({
          cause: h.cause, confidence: STRENGTH_CONFIDENCE[h.strength], rationale: h.explanation,
          evidenceIds: h.evidenceIds, strength: h.strength, counterEvidenceIds: h.counterEvidenceIds,
        })),
        missingEvidence: diagnosis.missingEvidence,
        summary: diagnosis.summary,
        requiresReview: diagnosis.requiresReview,
      },
      // Their diagnosis did not pass through this module's rule or Sapling checks.
      serverAttribution: { verifiedByRules: false, importedFrom: "@normal/contracts" },
      createdAt: utc(diagnosis.createdAt),
    },
    evidence: evidence.map(item => {
      const measurements: Record<string, string | number> = { category: item.category };
      for (const m of item.measurements) {
        measurements[m.metric] = m.value;
        measurements[`${m.metric}_unit`] = m.unit;
        if (m.baseline !== undefined) measurements[`${m.metric}_baseline`] = m.baseline;
      }
      if (item.window) { measurements.windowStartAt = utc(item.window.startAt); measurements.windowEndAt = utc(item.window.endAt); }
      return {
        schemaVersion: 1,
        evidenceId: item.evidenceId,
        investigationId: item.investigationId,
        businessId: item.businessId,
        observedFact: `${item.title}: ${item.observation}`,
        measurements,
        sourceRecordIds: item.sourceRecords.map(ref => `${ref.collection}/${ref.recordId}`),
        retrievedAt: utc(item.retrievedAt),
      };
    }),
  });
}

/** Accepts either contract: this module's own PlanHandoff, or the intelligence team's `@normal/contracts` one. */
export function parseAnyHandoff(input: unknown): PlanHandoffT {
  const own = PlanHandoff.safeParse(input);
  if (own.success) return own.data;
  try {
    return fromPartnerHandoff(input);
  } catch (error) {
    const detail = error instanceof Error && "issues" in error ? (error as any).issues.slice(0, 3).map((i: any) => `${i.path.join(".")}: ${i.message}`).join("; ") : String(error);
    throw new ToolError("INTELLIGENCE_INVALID", `The intelligence plan matches neither contract (${detail})`, false, false, 502);
  }
}

import { z } from "zod";

// Base primitives
export const Id = z.string().min(1);
export const DateTime = z.string().datetime();
export const Rate = z.number().min(0).max(1);

export const SchemaMeta = {
  schemaVersion: z.literal(1).default(1),
};

// ---------------- Enums to freeze before integration ----------------
export const RootCause = z.enum([
  "ad_fatigue",
  "ad_inefficiency",
  "delivery_delays",
  "product_quality",
  "negative_sentiment",
  "checkout_failure",
  "discount_failure",
  "stockout",
  "viral_demand",
  "seasonality",
  "unknown",
]);
export type RootCauseT = z.infer<typeof RootCause>;

export const AgentType = z.enum([
  "marketing",
  "customer_care",
  "storefront",
  "supplier",
  "growth",
]);
export type AgentTypeT = z.infer<typeof AgentType>;

export const ActionType = z.enum([
  "ads.set_daily_budget",
  "customer.send_delay_notice",
  "storefront.publish_banner",
  "marketing.publish_ad",
  "customer.send_promotion_email",
  "storefront.create_discount",
]);
export type ActionTypeT = z.infer<typeof ActionType>;

export const PlanStatus = z.enum([
  "proposed",
  "awaiting_approval",
  "approved",
  "partially_approved",
  "executing",
  "completed",
  "rejected",
  "expired",
]);
export type PlanStatusT = z.infer<typeof PlanStatus>;

export const ExecutionStatus = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);
export type ExecutionStatusT = z.infer<typeof ExecutionStatus>;

// ---------------- Core Business & Integrations ----------------
export const Business = z.object({
  ...SchemaMeta,
  businessId: Id,
  name: z.string().min(1),
  currency: z.string().length(3).default("GBP"),
  timezone: z.string().default("Europe/London"),
  createdAt: DateTime,
  updatedAt: DateTime,
}).strict();

export const Integration = z.object({
  ...SchemaMeta,
  integrationId: Id,
  businessId: Id,
  provider: z.enum(["shopify", "stripe", "meta_ads", "shipstation", "trustpilot"]),
  status: z.enum(["connected", "syncing", "error", "disconnected"]),
  scopes: z.array(z.string()),
  syncCursor: z.string().optional(),
  secretReference: z.string().min(1), // Secret ref only, never raw credentials
  createdAt: DateTime,
  updatedAt: DateTime,
}).strict();

// ---------------- Telemetry & Observed Events ----------------
export const BusinessEventType = z.enum([
  "web.session_started",
  "order.completed",
  "order.refunded",
  "checkout.failed",
  "ad.metrics_observed",
  "delivery.status_changed",
  "review.created",
  "social.mention_observed",
  "inventory.level_changed",
  "campaign.budget_updated",
  "customer.message_sent",
  "storefront.banner_published",
  "promotion.created",
  "support.ticket_created",
]);

export const BusinessEvent = z.object({
  ...SchemaMeta,
  eventId: Id,
  businessId: Id,
  type: BusinessEventType,
  payload: z.record(z.string(), z.unknown()),
  occurredAt: DateTime,
  receivedAt: DateTime,
  source: z.string().min(1),
}).strict();

export const MetricSnapshot = z.object({
  ...SchemaMeta,
  snapshotId: Id,
  businessId: Id,
  periodStart: DateTime,
  periodEnd: DateTime,
  dimension: z.string().min(1),
  rawCounts: z.record(z.string(), z.number()),
  calculatedRates: z.record(z.string(), z.number()),
  createdAt: DateTime,
}).strict();

export const Anomaly = z.object({
  ...SchemaMeta,
  anomalyId: Id,
  businessId: Id,
  metric: z.string().min(1),
  currentWindowStart: DateTime,
  currentWindowEnd: DateTime,
  baselineWindowStart: DateTime,
  baselineWindowEnd: DateTime,
  severity: z.enum(["low", "medium", "high", "critical"]),
  baselineValue: z.number(),
  currentValue: z.number(),
  deltaPercent: z.number(),
  detectedAt: DateTime,
}).strict();

// ---------------- Forensics & Investigation ----------------
export const Evidence = z.object({
  ...SchemaMeta,
  evidenceId: Id,
  investigationId: Id,
  businessId: Id,
  observedFact: z.string().min(1),
  measurements: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  sourceRecordIds: z.array(Id),
  retrievedAt: DateTime,
}).strict();

export const Investigation = z.object({
  ...SchemaMeta,
  investigationId: Id,
  businessId: Id,
  anomalyIds: z.array(Id),
  status: z.enum(["active", "diagnosed", "plan_proposed", "resolved", "dismissed"]),
  evidenceIds: z.array(Id).default([]),
  diagnosisId: Id.optional(),
  planId: Id.optional(),
  createdAt: DateTime,
  updatedAt: DateTime,
}).strict();

// ---------------- Model Output & Attribution ----------------
export const DiagnosisModelOutput = z.object({
  primaryCause: RootCause,
  supportedHypotheses: z.array(
    z.object({
      cause: RootCause,
      confidence: Rate,
      rationale: z.string().min(1),
      evidenceIds: z.array(Id),
      // Set only on diagnoses imported from @normal/contracts, which grade hypotheses instead of scoring them.
      strength: z.enum(["weak", "moderate", "strong"]).optional(),
      counterEvidenceIds: z.array(Id).optional(),
    })
  ),
  missingEvidence: z.array(z.string()).default([]),
  summary: z.string().min(1).optional(),
  requiresReview: z.boolean().optional(),
}).strict();

// Banyan Sapling verdict on a diagnosis: policy + cited evidence + claim.
export const SaplingLabel = z.enum(["supported", "violation", "insufficient_information", "inconsistent_context"]);
export const SaplingCheck = z.object({
  verdict: z.union([SaplingLabel, z.literal("unsure")]),
  blocked: z.boolean(),
  status: z.string(),
  rawLabel: z.string(),
  probabilities: z.record(z.string(), z.number()),
  policy: z.string().min(1),
  claim: z.string().min(1),
  evidenceIds: z.array(Id),
  latencyMs: z.number().nonnegative(),
  error: z.string().optional(),
}).strict();

export const Diagnosis = z.object({
  ...SchemaMeta,
  diagnosisId: Id,
  investigationId: Id,
  modelCallId: Id,
  output: DiagnosisModelOutput,
  serverAttribution: z.object({
    verifiedByRules: z.boolean().default(false),
    saplingVerification: z.union([SaplingLabel, z.literal("unsure")]).optional(),
    saplingCheck: SaplingCheck.optional(),
    importedFrom: z.literal("@normal/contracts").optional(),
  }).strict(),
  createdAt: DateTime,
}).strict();

// ---------------- Action Planning & Orchestration ----------------
export const ActionProposal = z.object({
  actionId: Id,
  agent: AgentType,
  title: z.string().min(1),
  rationale: z.string().min(1),
  evidenceIds: z.array(Id),
  actionType: ActionType,
  params: z.record(z.string(), z.unknown()),
  requiresApproval: z.boolean().default(true),
  dependsOnActionIds: z.array(Id).default([]),
  risk: z.enum(["low", "medium", "high"]).default("medium"),
}).strict();

export const ProposedPlan = z.object({
  ...SchemaMeta,
  planId: Id,
  planVersion: z.number().int().positive().default(1),
  businessId: Id,
  investigationId: Id,
  diagnosisId: Id,
  status: PlanStatus,
  objective: z.string().min(1),
  summary: z.string().min(1),
  actions: z.array(ActionProposal),
  successCriteria: z.array(
    z.object({
      metric: z.string().min(1),
      direction: z.enum(["increase", "decrease"]),
      measurementWindowMinutes: z.number().int().positive(),
    })
  ),
  createdAt: DateTime,
  expiresAt: DateTime,
}).strict();

export const PlanApproval = z.object({
  ...SchemaMeta,
  approvalId: Id,
  planId: Id,
  planVersion: z.number().int().positive(),
  decision: z.enum(["approved", "partially_approved", "rejected"]),
  approvedActionIds: z.array(Id),
  reviewingPrincipal: z.string().min(1),
  decidedAt: DateTime,
}).strict();

export const AgentMission = z.object({
  ...SchemaMeta,
  missionId: Id,
  planId: Id,
  assignedAgent: AgentType,
  goal: z.string().min(1),
  actionIds: z.array(Id),
  status: z.enum(["assigned", "in_progress", "completed", "failed", "cancelled"]),
  createdAt: DateTime,
  updatedAt: DateTime,
}).strict();

export const ActionExecution = z.object({
  ...SchemaMeta,
  executionId: Id,
  planId: Id,
  planVersion: z.number().int().positive(),
  approvalId: Id,
  actionId: Id,
  missionId: Id,
  idempotencyKey: Id,
  status: ExecutionStatus,
  attempts: z.number().int().nonnegative(),
  toolName: z.string().min(1),
  dryRun: z.boolean(),
  startedAt: DateTime.optional(),
  finishedAt: DateTime.optional(),
  result: z.object({
    providerOperationId: Id.optional(),
    affectedEntityIds: z.array(Id),
    verification: z.string().min(1),
  }).strict().optional(),
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean(),
  }).strict().optional(),
}).strict();

export const ActionOutcome = z.object({
  ...SchemaMeta,
  outcomeId: Id,
  executionId: Id,
  actionId: Id,
  status: z.enum(["verified", "not_verified", "monitoring", "unknown"]),
  observedMetricSnapshotIds: z.array(Id),
  summary: z.string().min(1),
  observedAt: DateTime,
}).strict();

// What a whole plan changed: business metrics measured before execution and again after it, judged against
// the plan's success criteria. The figures come from the simulator's event stream, not from the plan.
export const CriterionResult = z.object({
  metric: z.string().min(1),
  direction: z.enum(["increase", "decrease"]),
  before: z.number().nullable(),
  after: z.number().nullable(),
  changePercent: z.number().nullable(),
  result: z.enum(["met", "not_met", "no_data"]),
}).strict();

export const PlanOutcome = z.object({
  ...SchemaMeta,
  planOutcomeId: Id,
  planId: Id,
  planVersion: z.number().int().positive(),
  diagnosisId: Id,
  diagnosedCause: RootCause,
  diagnosisMubitRequestId: z.string().optional(),
  diagnosisTaskFingerprint: z.string().optional(),
  simulationRunId: Id,
  scenario: z.string().min(1),
  actionsTaken: z.array(z.object({ actionId: Id, actionType: z.string().min(1), status: ExecutionStatus }).strict()),
  baseline: MetricSnapshot,
  after: MetricSnapshot.optional(),
  criteria: z.array(CriterionResult),
  verdict: z.enum(["pending", "measuring", "resolved", "partially_resolved", "not_resolved", "inconclusive"]),
  summary: z.string().min(1),
  createdAt: DateTime,
  measuredAt: DateTime.optional(),
}).strict();

// ---------------- Mubit Request Trace / Human Feedback / Adaptation ----------------
export const ModelCall = z.object({
  ...SchemaMeta,
  modelCallId: Id,
  investigationId: Id.optional(),
  taskKey: z.string().min(1),
  promptVersion: z.string().min(1),
  instructionsFingerprint: z.string().min(1),
  route: z.literal("mubit"),
  providerModel: z.string().min(1),
  modelKind: z.enum(["provider", "adapter"]),
  adapterVersionId: Id.optional(),
  sessionId: Id,
  inputEvidenceIds: z.array(Id),
  mubitRequestId: z.string().optional(),
  appliedCorrectionIds: z.array(Id).optional(),
  appliedOutcomeIds: z.array(Id).optional(),
  responseRecordId: Id.optional(),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  costUsdMicros: z.number().int().nonnegative().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  createdAt: DateTime,
}).strict();

export const ModelCorrection = z.object({
  ...SchemaMeta,
  correctionId: Id,
  investigationId: Id,
  diagnosisId: Id,
  modelCallId: Id,
  predictedCause: RootCause,
  correctedCause: RootCause,
  correctedEvidenceIds: z.array(Id),
  note: z.string().optional(),
  verifiedByUserId: Id,
  verifiedAt: DateTime,
  ingestionStatus: z.enum(["local_only", "queued", "submitted", "confirmed", "unsupported"]),
}).strict();

// A verified merchant correction kept by Normal. Mubit has no feedback API, so it reaches Mubit only
// as a labelled example inside later diagnosis calls of the same task. Evidence IDs are dropped on purpose.
export const CorrectionRecord = z.object({
  correction: ModelCorrection,
  correctedMubitRequestId: z.string().optional(),
  examples: z.array(z.object({ observedFact: z.string().min(1), measurements: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])) }).strict()).min(1),
}).strict();

export const AdapterRecord = z.object({
  ...SchemaMeta,
  adapterRecordId: Id,
  taskKey: z.string().min(1),
  mubitTaskId: z.string().optional(),
  mubitAdapterVersionId: z.string().optional(),
  status: z.enum(["unknown", "collecting", "training", "testing", "passed", "failed"]),
  keptExamples: z.number().int().nonnegative().optional(),
  checkedAt: DateTime,
}).strict();

export const EvaluationCase = z.object({
  ...SchemaMeta,
  evaluationCaseId: Id,
  datasetId: Id,
  scenarioId: Id,
  inputEvidenceIds: z.array(Id),
  groundTruthCause: RootCause,
  split: z.enum(["train", "validation", "test"]),
}).strict();

export const EvaluationResult = z.object({
  ...SchemaMeta,
  evaluationResultId: Id,
  evaluationCaseId: Id,
  modelCallId: Id,
  modelKind: z.enum(["provider", "adapter"]),
  predictedCause: RootCause,
  correct: z.boolean(),
  latencyMs: z.number().int().nonnegative(),
  costUsdMicros: z.number().int().nonnegative().optional(),
  evaluatedAt: DateTime,
}).strict();

// ---------------- Simulator (PRIVATE ground truth, never passed to LLM) ----------------
export const ScenarioName = z.enum([
  "healthy",
  "ad_fatigue",
  "delivery_delays",
  "negative_reviews",
  "promo_checkout_failure",
  "viral_demand",
]);
export type ScenarioNameT = z.infer<typeof ScenarioName>;

export const SimulatorRun = z.object({
  ...SchemaMeta,
  simulationRunId: Id,
  seed: z.number().int(),
  status: z.enum(["created", "running", "paused", "completed"]),
  virtualTime: DateTime,
  minutesPerTick: z.number().int().positive(),
  activeScenario: ScenarioName,
  scenarioSeverity: Rate,
  createdAt: DateTime,
  updatedAt: DateTime,
}).strict();

export const InjectScenarioRequest = z.object({
  simulationRunId: Id,
  scenario: ScenarioName,
  severity: Rate,
}).strict();

export const SimulatorTickRequest = z.object({
  simulationRunId: Id,
  ticks: z.number().int().positive().max(60).default(1),
}).strict();

export const SimulatorTickResponse = z.object({
  simulationRunId: Id,
  virtualTime: DateTime,
  generatedEventIds: z.array(Id),
  generatedEventsCount: z.number().int().nonnegative(),
  metricSnapshotIds: z.array(Id),
}).strict();

/** Server-only fixture. NEVER pass this record to the investigation model. */
export const ScenarioGroundTruth = z.object({
  simulationRunId: Id,
  scenario: ScenarioName,
  actualCauses: z.array(RootCause).min(1),
  hiddenFaultParameters: z.record(z.string(), z.unknown()),
}).strict();

// ---------------- API Response Wrappers ----------------
export const ApiError = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    requestId: Id,
  }).strict(),
}).strict();

export const IngestResult = z.object({
  accepted: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  eventIds: z.array(Id),
}).strict();

export const PlanHandoff = z.object({
  plan: ProposedPlan,
  diagnosis: Diagnosis,
  evidence: z.array(Evidence),
}).strict();

// Type exports
export type BusinessT = z.infer<typeof Business>;
export type IntegrationT = z.infer<typeof Integration>;
export type BusinessEventT = z.infer<typeof BusinessEvent>;
export type MetricSnapshotT = z.infer<typeof MetricSnapshot>;
export type AnomalyT = z.infer<typeof Anomaly>;
export type InvestigationT = z.infer<typeof Investigation>;
export type EvidenceT = z.infer<typeof Evidence>;
export type DiagnosisT = z.infer<typeof Diagnosis>;
export type DiagnosisModelOutputT = z.infer<typeof DiagnosisModelOutput>;
export type SaplingLabelT = z.infer<typeof SaplingLabel>;
export type SaplingCheckT = z.infer<typeof SaplingCheck>;
export type ActionProposalT = z.infer<typeof ActionProposal>;
export type ProposedPlanT = z.infer<typeof ProposedPlan>;
export type PlanApprovalT = z.infer<typeof PlanApproval>;
export type AgentMissionT = z.infer<typeof AgentMission>;
export type ActionExecutionT = z.infer<typeof ActionExecution>;
export type ActionOutcomeT = z.infer<typeof ActionOutcome>;
export type PlanOutcomeT = z.infer<typeof PlanOutcome>;
export type CriterionResultT = z.infer<typeof CriterionResult>;
export type ModelCallT = z.infer<typeof ModelCall>;
export type ModelCorrectionT = z.infer<typeof ModelCorrection>;
export type AdapterRecordT = z.infer<typeof AdapterRecord>;
export type CorrectionRecordT = z.infer<typeof CorrectionRecord>;
export type EvaluationCaseT = z.infer<typeof EvaluationCase>;
export type EvaluationResultT = z.infer<typeof EvaluationResult>;
export type SimulatorRunT = z.infer<typeof SimulatorRun>;
export type ScenarioGroundTruthT = z.infer<typeof ScenarioGroundTruth>;
export type PlanHandoffT = z.infer<typeof PlanHandoff>;

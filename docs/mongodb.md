# MongoDB collection map and indexes

## Collections

| Collection | Schema | Owner | Purpose |
|---|---|---|---|
| `businesses` | `Business` | Shared | Tenant settings |
| `integrations` | `Integration` | Ingestion | Provider, scopes, sync cursor, secret reference (never tokens) |
| `business_events` | `BusinessEvent` | Ingestion | Immutable event ledger |
| `metric_snapshots` | `MetricSnapshot` | Analytics | Computed counters/rates per period |
| `anomalies` | `Anomaly` | Analytics | Significant changes versus baseline |
| `investigations` | `Investigation` | Intelligence | Case state and linked record IDs |
| `evidence` | `Evidence` | Intelligence | Independently traceable findings |
| `diagnoses` | `Diagnosis` | Intelligence | Mubit-routed task output |
| `plans` | `ProposedPlan` | Intelligence | Immutable versions of execution proposals |
| `approvals` | `PlanApproval` | Execution | Human approval decisions |
| `agent_missions` | `AgentMission` | Execution | Agent job tracking |
| `action_executions` | `ActionExecution` | Execution | Idempotent side effects |
| `action_outcomes` | `ActionOutcome` | Execution | Observed verification/outcomes |
| `model_calls` | `ModelCall` | Intelligence | Application-side trace of calls routed through Mubit |
| `model_corrections` | `ModelCorrection` | Intelligence | Verified user feedback, separate from actual Mubit acceptance |
| `adapter_records` | `AdapterRecord` | Intelligence | Cached adapter status observed from workspace |
| `evaluation_cases` | `EvaluationCase` | Intelligence | Privately labelled train/validation/test fixtures |
| `evaluation_results` | `EvaluationResult` | Intelligence | Actual baseline/adapter predictions and metrics |
| `simulator_runs` | `SimulatorRun` | Simulator | Seed, clock, scenario and run state |
| `simulator_ground_truth` | `ScenarioGroundTruth` | Simulator (private) | Hidden cause labels; do not expose to intelligence agent |

## Recommended indexes

```ts
// business_events
await db.collection('business_events').createIndex(
  { businessId: 1, 'provenance.connectorId': 1, 'provenance.sourceRecordId': 1 },
  { unique: true }
);
await db.collection('business_events').createIndex({ businessId: 1, occurredAt: -1, type: 1 });
await db.collection('metric_snapshots').createIndex({ businessId: 1, 'window.startAt': -1 });
await db.collection('investigations').createIndex({ businessId: 1, startedAt: -1 });
await db.collection('evidence').createIndex({ businessId: 1, investigationId: 1 });
await db.collection('plans').createIndex({ businessId: 1, planId: 1, planVersion: 1 }, { unique: true });
await db.collection('action_executions').createIndex({ businessId: 1, idempotencyKey: 1 }, { unique: true });
await db.collection('model_calls').createIndex({ businessId: 1, taskKey: 1, createdAt: -1 });
await db.collection('model_corrections').createIndex({ businessId: 1, diagnosisId: 1 });
```

**Data model note:** Keep source-provider IDs separate from Normal IDs, and use currency as an explicit field. Do not count refunds twice when computing net revenue. Do not add users' email addresses to LLM evidence packages unless necessary and authorised. Limit access to supplier and customer data. Use stable seed/run IDs to make demo repeatable.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CorrectionError, SubmitCorrectionParams, feedbackPipeline } from "../../../../intelligence/feedback-pipeline";
import { DIAGNOSIS_TASK_CONSOLE_NAME, diagnosisModel, diagnosisTaskFingerprint } from "../../../../intelligence/mubit-diagnoser";
import { Evidence, RootCause } from "../../../../contracts";

const CorrectionRequest = z.object({
  investigationId: z.string().min(1),
  diagnosisId: z.string().min(1),
  modelCallId: z.string().min(1),
  mubitRequestId: z.string().regex(/^mreq_[a-f0-9]{32}$/i).optional(),
  predictedCause: RootCause,
  correctedCause: RootCause,
  correctedEvidenceIds: z.array(z.string().min(1)).min(1),
  evidence: z.array(Evidence).min(1),
  note: z.string().max(500).optional(),
});

// What Normal can honestly say about the Mubit task. Kept-example counts and adapter status live only in the
// Mubit console, so they are not reported here.
async function status() {
  const records = await feedbackPipeline.list();
  const nextExamples = await feedbackPipeline.examplesForDiagnosis();
  return {
    mubitTask: {
      consoleName: DIAGNOSIS_TASK_CONSOLE_NAME,
      model: diagnosisModel(),
      fingerprint: diagnosisTaskFingerprint(),
      defaultKeptExamplesToTrain: 25,
      adapterStatusSource: "Mubit console (Tasks and Adapters pages)",
    },
    corrections: records,
    nextDiagnosisCorrectionIds: nextExamples.map(record => record.correction.correctionId),
  };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "A JSON correction body is required." } }, { status: 400 });
  }
  const parsed = CorrectionRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_CORRECTION", message: "A correction needs the diagnosis IDs, valid causes and the cited evidence." } }, { status: 400 });
  }
  try {
    const record = await feedbackPipeline.submitCorrection(parsed.data as SubmitCorrectionParams);
    return NextResponse.json({ record, ...(await status()) });
  } catch (err) {
    if (err instanceof CorrectionError) return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: 400 });
    return NextResponse.json({ error: { code: "CORRECTION_FAILED", message: "The correction could not be saved. Please retry." } }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(await status());
}

export async function DELETE() {
  await feedbackPipeline.clear();
  return NextResponse.json(await status());
}

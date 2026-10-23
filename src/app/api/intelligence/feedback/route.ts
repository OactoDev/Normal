import { NextRequest, NextResponse } from "next/server";
import { feedbackPipeline } from "../../../../intelligence/feedback-pipeline";
import { RootCause } from "../../../../contracts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      investigationId,
      diagnosisId,
      modelCallId,
      predictedCause,
      correctedCause,
      correctedEvidenceIds,
      note,
    } = body;

    if (!investigationId || !diagnosisId || !modelCallId || !predictedCause || !correctedCause) {
      return NextResponse.json(
        { error: { code: "MISSING_FIELDS", message: "Missing required correction fields" } },
        { status: 400 }
      );
    }

    const validatedPredicted = RootCause.safeParse(predictedCause);
    const validatedCorrected = RootCause.safeParse(correctedCause);

    if (!validatedPredicted.success || !validatedCorrected.success) {
      return NextResponse.json(
        { error: { code: "INVALID_CAUSE", message: "Invalid RootCause enum value provided" } },
        { status: 400 }
      );
    }

    const result = await feedbackPipeline.submitCorrection({
      investigationId,
      diagnosisId,
      modelCallId,
      predictedCause: validatedPredicted.data,
      correctedCause: validatedCorrected.data,
      correctedEvidenceIds: Array.isArray(correctedEvidenceIds) ? correctedEvidenceIds : [],
      note,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "FEEDBACK_FAILED", message: err.message || "Failed to submit feedback" } },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    adapter: feedbackPipeline.getAdapterRecord(),
    corrections: feedbackPipeline.getCorrections(),
  });
}

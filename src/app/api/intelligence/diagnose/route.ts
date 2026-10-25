import { NextRequest, NextResponse } from "next/server";
import { telemetrySimulator } from "../../../../intelligence/telemetry-simulator";
import { anomalyDetector } from "../../../../intelligence/anomaly-detector";
import { evidenceCollector } from "../../../../intelligence/evidence-collector";
import { MubitDiagnosisError, mubitDiagnoser } from "../../../../intelligence/mubit-diagnoser";
import { feedbackPipeline } from "../../../../intelligence/feedback-pipeline";
import { outcomesForDiagnosis } from "../../../../execution/outcome-measurement";
import { Evidence, Investigation } from "../../../../contracts";
import { z } from "zod";

export async function POST(request: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body optional; will use active simulation if omitted
    }

    let investigation = body.investigation;
    let evidence = body.evidence;

    if (!investigation || !evidence || evidence.length === 0) {
      const simState = telemetrySimulator.getState();
      const detection = anomalyDetector.analyzeEvents(simState.events);
      const packet = evidenceCollector.assembleInvestigation(
        detection.anomalies,
        simState.events
      );
      investigation = packet.investigation;
      evidence = packet.evidence;
    }

    // Verified merchant corrections go to Mubit as labelled examples inside this same diagnosis task.
    const parsedInvestigation = Investigation.parse(investigation);
    const parsedEvidence = z.array(Evidence).parse(evidence);
    const corrections = await feedbackPipeline.examplesForDiagnosis();
    // Measured results of earlier plans ride along too, so Mubit sees which diagnoses led to fixes that worked.
    const outcomes = await outcomesForDiagnosis();

    // ?stream=1: Gemini's answer streams through Mubit as server-sent events (delta pieces, then the validated
    // result or an error). The answer is only accepted after the same checks as the plain call.
    if (request.nextUrl.searchParams.get("stream") === "1") {
      const encoder = new TextEncoder();
      const body = new ReadableStream({
        async start(controller) {
          const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          // Sent at once so the browser connects before Gemini's first words (it reasons first, which takes seconds).
          send("started", { model: "gemini-4-argon", route: "streamGenerateContent" });
          try {
            send("result", await mubitDiagnoser.diagnose(parsedInvestigation, parsedEvidence, corrections, text => send("delta", { text }), outcomes));
          } catch (err: any) {
            send("error", err instanceof MubitDiagnosisError
              ? { code: err.code, message: err.message, status: err.status, ...(err.requestId ? { requestId: err.requestId } : {}) }
              : { code: "DIAGNOSIS_FAILED", message: "Failed to execute AI diagnosis", status: 500 });
          } finally {
            controller.close();
          }
        },
      });
      return new Response(body, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
    }

    const result = await mubitDiagnoser.diagnose(parsedInvestigation, parsedEvidence, corrections, undefined, outcomes);
    return NextResponse.json(result);
  } catch (err: any) {
    if (err instanceof MubitDiagnosisError) return NextResponse.json({ error: { code: err.code, message: err.message, ...(err.requestId ? { requestId: err.requestId } : {}) } }, { status: err.status });
    if (err instanceof z.ZodError) return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "A valid investigation and evidence packet are required." } }, { status: 400 });
    return NextResponse.json(
      { error: { code: "DIAGNOSIS_FAILED", message: err.message || "Failed to execute AI diagnosis" } },
      { status: 500 }
    );
  }
}

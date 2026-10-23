import { ModelCorrectionT, AdapterRecordT, RootCauseT } from "../contracts";

export interface SubmitCorrectionParams {
  investigationId: string;
  diagnosisId: string;
  modelCallId: string;
  predictedCause: RootCauseT;
  correctedCause: RootCauseT;
  correctedEvidenceIds: string[];
  note?: string;
  verifiedByUserId?: string;
}

export class MubitFeedbackPipeline {
  private corrections: ModelCorrectionT[] = [];
  private adapterRecord: AdapterRecordT;

  constructor() {
    this.adapterRecord = {
      schemaVersion: 1,
      adapterRecordId: "adapt_rec_001",
      taskKey: "normal_incident_diagnosis",
      mubitTaskId: "task_normal_diag_v1",
      mubitAdapterVersionId: "adapt_v1.0",
      status: "collecting",
      keptExamples: 0,
      checkedAt: new Date().toISOString(),
    };
  }

  public async submitCorrection(
    params: SubmitCorrectionParams
  ): Promise<{ correction: ModelCorrectionT; adapter: AdapterRecordT }> {
    const correctionId = `corr_${Date.now()}`;
    const now = new Date().toISOString();
    const mubitApiKey = process.env.MUBIT_API_KEY || "";

    const correction: ModelCorrectionT = {
      schemaVersion: 1,
      correctionId,
      investigationId: params.investigationId,
      diagnosisId: params.diagnosisId,
      modelCallId: params.modelCallId,
      predictedCause: params.predictedCause,
      correctedCause: params.correctedCause,
      correctedEvidenceIds: params.correctedEvidenceIds,
      note: params.note || "Operator verified root cause.",
      verifiedByUserId: params.verifiedByUserId || "usr_operator_01",
      verifiedAt: now,
      ingestionStatus: "submitted",
    };

    // Attempt to notify Mubit feedback endpoint or update local adapter record
    try {
      if (mubitApiKey) {
        // Forward to Mubit feedback / annotations API
        await fetch("https://api.mubit.ai/v1/feedback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mubitApiKey}`,
          },
          body: JSON.stringify({
            modelCallId: params.modelCallId,
            predictedLabel: params.predictedCause,
            correctedLabel: params.correctedCause,
            taskKey: "normal_incident_diagnosis",
            note: params.note,
          }),
        }).catch(() => {
          // Non-blocking if feedback endpoint returns 404/500
        });
      }
    } catch {
      // Non-blocking
    }

    this.corrections.push(correction);

    // Update adapter record metrics
    this.adapterRecord.keptExamples = (this.adapterRecord.keptExamples || 0) + 1;
    this.adapterRecord.checkedAt = now;
    if (this.adapterRecord.keptExamples >= 3) {
      this.adapterRecord.status = "training";
      this.adapterRecord.mubitAdapterVersionId = "adapt_v1.1_tuned";
    }

    return {
      correction,
      adapter: this.adapterRecord,
    };
  }

  public getAdapterRecord(): AdapterRecordT {
    return this.adapterRecord;
  }

  public getCorrections(): ModelCorrectionT[] {
    return this.corrections;
  }
}

export const feedbackPipeline = new MubitFeedbackPipeline();

import { randomUUID } from "node:crypto";
import { CorrectionRecordT, EvidenceT, ModelCorrectionT, RootCauseT } from "../contracts";
import { corrections } from "../store/repos";
import { MAX_CORRECTION_EXAMPLES } from "./mubit-diagnoser";

export interface SubmitCorrectionParams {
  investigationId: string;
  diagnosisId: string;
  modelCallId: string;
  mubitRequestId?: string;
  predictedCause: RootCauseT;
  correctedCause: RootCauseT;
  correctedEvidenceIds: string[];
  evidence: EvidenceT[];
  note?: string;
  verifiedByUserId?: string;
}

export class CorrectionError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "CorrectionError";
  }
}

// Mubit has no feedback or annotation API (see docs/mubit/concepts.md). A correction is therefore a local
// record that changes later diagnoses by riding along as a labelled example in the next Mubit calls of the
// same task. Adapter training and kept-example counts are only visible in the Mubit console.
export class CorrectionMemory {
  public async submitCorrection(params: SubmitCorrectionParams): Promise<CorrectionRecordT> {
    const cited = new Set(params.correctedEvidenceIds);
    const examples = params.evidence
      .filter(item => cited.has(item.evidenceId))
      .map(item => ({ observedFact: item.observedFact, measurements: item.measurements }));
    if (examples.length === 0 || examples.length !== cited.size) {
      throw new CorrectionError("CORRECTION_EVIDENCE_REQUIRED", "A correction must cite evidence from the diagnosed incident.");
    }
    const correction: ModelCorrectionT = {
      schemaVersion: 1,
      correctionId: `corr_${randomUUID()}`,
      investigationId: params.investigationId,
      diagnosisId: params.diagnosisId,
      modelCallId: params.modelCallId,
      predictedCause: params.predictedCause,
      correctedCause: params.correctedCause,
      correctedEvidenceIds: [...cited],
      note: params.note?.trim() || undefined,
      verifiedByUserId: params.verifiedByUserId || "usr_operator_01",
      verifiedAt: new Date().toISOString(),
      ingestionStatus: "local_only",
    };
    const record: CorrectionRecordT = {
      correction,
      ...(params.mubitRequestId ? { correctedMubitRequestId: params.mubitRequestId } : {}),
      examples,
    };
    return corrections.insert(correction.correctionId, record);
  }

  /** Newest first. */
  public async list(): Promise<CorrectionRecordT[]> {
    return (await corrections.find()).sort((a, b) => b.correction.verifiedAt.localeCompare(a.correction.verifiedAt));
  }

  /** The newest correction per evidence pattern, capped, ready for the diagnosis user message. */
  public async examplesForDiagnosis(): Promise<CorrectionRecordT[]> {
    const seen = new Set<string>();
    const picked: CorrectionRecordT[] = [];
    for (const record of await this.list()) {
      const pattern = record.examples.map(example => example.observedFact).sort().join("\n");
      if (seen.has(pattern)) continue;
      seen.add(pattern);
      picked.push(record);
      if (picked.length === MAX_CORRECTION_EXAMPLES) break;
    }
    return picked;
  }

  public async clear(): Promise<void> {
    for (const record of await corrections.find()) await corrections.remove(record.correction.correctionId);
  }
}

export const feedbackPipeline = new CorrectionMemory();

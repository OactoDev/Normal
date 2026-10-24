import { NextResponse } from "next/server";
import { modelCalls } from "../../../../store/repos";

const TASKS: Record<string, string> = {
  normal_incident_diagnosis: "Root-cause diagnosis",
  normal_recovery_planning: "Recovery planning",
  normal_email_draft: "Customer email drafts",
};

/** The app's Mubit calls grouped by task: how many, the latest request ID and the model Mubit reported. */
export async function GET() {
  const calls = (await modelCalls.find()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const tasks = Object.entries(TASKS).map(([taskKey, label]) => {
    const own = calls.filter(call => call.taskKey === taskKey), last = own.at(-1);
    return {
      taskKey, label, calls: own.length, fingerprint: last?.instructionsFingerprint,
      lastRequestId: last?.mubitRequestId, lastModel: last?.providerModel, lastModelKind: last?.modelKind, lastAt: last?.createdAt,
      adapterAnswers: own.filter(call => call.modelKind === "adapter").length,
    };
  });
  return NextResponse.json({ tasks, totalCalls: calls.length });
}

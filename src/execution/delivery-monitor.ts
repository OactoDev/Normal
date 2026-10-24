import { emails, executions, outcomes } from "../store/repos";
import { getEmailStatus } from "../tools/email-provider";
import { emitEvent } from "../simulator/events";
import { log } from "./execute-action";

// Resend reports "delivered" a few seconds after it accepts a message, so accepted sends are re-checked
// at most every RECHECK_MS, and only for MONITOR_WINDOW_MS after sending; after that they stay "accepted".
const RECHECK_MS = 10_000;
const MONITOR_WINDOW_MS = 30 * 60_000;

/** Re-checks accepted Resend sends for a plan and promotes the ledger and ActionOutcome once delivery is confirmed. */
export async function reconcileDeliveries(planId: string, check: (id: string) => Promise<"accepted" | "delivered"> = getEmailStatus, now = Date.now()) {
  const due = (await emails.find({ planId })).filter(e =>
    e.provider === "resend" && e.status === "accepted" && e.providerOperationId &&
    now - Date.parse(e.sentAt) < MONITOR_WINDOW_MS &&
    (!e.checkedAt || now - Date.parse(e.checkedAt) >= RECHECK_MS));
  for (const e of due) {
    // Claiming the check slot first keeps overlapping polls from querying Resend for the same message twice.
    if (!await emails.compareAndSet(e.key, { status: "accepted", checkedAt: e.checkedAt }, { checkedAt: new Date(now).toISOString() })) continue;
    if (await check(e.providerOperationId) !== "delivered") continue;
    await emails.update(e.key, { $set: { status: "delivered" } });
    await emitEvent(`${e.key}:delivered`, "customer.message_sent", { planId, actionId: e.actionId, orderId: e.orderId, status: "delivered", provider: e.provider, providerOperationId: e.providerOperationId });
  }

  // Every email action is considered, so a send Resend reported delivered at send time is promoted too.
  for (const actionId of new Set((await emails.find({ planId })).map(e => e.actionId))) {
    const sends = await emails.find({ planId, actionId });
    if (!sends.length || !sends.every(s => s.status === "delivered")) continue;
    const execution = (await executions.find({ planId, actionId })).find(x => x.status === "succeeded");
    const outcome = execution && await outcomes.findOne(execution.executionId);
    if (!outcome || outcome.status !== "monitoring") continue;
    const summary = `${sends.length}/${sends.length} messages delivered (Resend last_event=delivered)`;
    await outcomes.update(execution.executionId, { $set: { status: "verified", summary, observedAt: new Date(now).toISOString() } });
    await log(execution, `delivery confirmed: ${summary}`);
  }
}

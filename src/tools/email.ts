import { z } from "zod";
import { EmailParams } from "../execution/action-params";
import { orders, emails } from "../store/repos";
import { ToolError } from "../execution/retry-policy";
import { draftParagraph } from "../llm/mubit";
import { shippingDelayTemplate } from "./email-templates";
import { emailProvider, sendEmail } from "./email-provider";
export async function executeSendDelayNotice(raw: unknown, context: { planId: string; actionId: string; idempotencyKey: string }) {
  const p = EmailParams.parse(raw), provider = emailProvider();
  const to = process.env.EMAIL_TEST_RECIPIENT || (["memory", "demo"].includes(provider) ? "controlled@example.com" : "");
  if (!z.string().email().safeParse(to).success) throw new ToolError("EMAIL_CONFIG", "EMAIL_TEST_RECIPIENT must be a controlled test inbox");
  const target = (await orders.find({ businessId: "nova_store", status: "delayed" })).filter(o => p.orderIds.includes(o.orderId)).slice(0,p.maxRecipients);
  if (!target.length) throw new ToolError("NO_RECIPIENTS", "No authorised delayed orders");
  for (const order of target) {
    const key = `${context.idempotencyKey}:${order.orderId}`, existing = await emails.findOne(key);
    if (existing && ["accepted", "delivered"].includes(existing.status)) continue;
    if (existing && ["sending", "ambiguous"].includes(existing.status)) throw new ToolError("EMAIL_AMBIGUOUS", `Send for ${order.orderId} requires provider reconciliation; not resent`, false, true);
    const draft = await draftParagraph({ customerName: order.customerName, orderId: order.orderId, carrier: order.carrier, items: order.items });
    const record = { key, planId: context.planId, actionId: context.actionId, orderId: order.orderId, status: "sending" as const, provider, to, subject: `${shippingDelayTemplate.subject} [intended for ${order.customerName}]`, body: shippingDelayTemplate.render(order.customerName, order.orderId, draft.paragraph), modelUsed: draft.modelUsed, sentAt: new Date().toISOString() };
    const claimed = existing ? await emails.compareAndSet(key, { status: "failed" }, record) : await emails.claim(key,record);
    if (!claimed) throw new ToolError("EMAIL_IN_PROGRESS", "Recipient is already claimed", false, true);
    try {
      const sent = await sendEmail({ ...record, key });
      await emails.update(key, { $set: sent });
    } catch (e) {
      const error = e instanceof ToolError ? e : new ToolError("EMAIL_AMBIGUOUS", String(e), false, true);
      await emails.update(key, { $set: { status: error.sideEffectPossible ? "ambiguous" : "failed" } });
      throw error;
    }
  }
  return { emails: await emails.find({ planId: context.planId, actionId: context.actionId }) };
}

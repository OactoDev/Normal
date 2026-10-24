import nodemailer from "nodemailer";
import { randomUUID, createHash } from "crypto";
import { ToolError } from "../execution/retry-policy";
const g = globalThis as typeof globalThis & { normalEthereal?: ReturnType<typeof nodemailer.createTestAccount> };
export function emailProvider() {
  const provider = process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? "resend" : "ethereal");
  if (provider === "demo" && process.env.PUBLIC_DEMO === "1") return provider;
  if (!["resend", "ethereal", "memory"].includes(provider) || (provider === "memory" && process.env.NODE_ENV !== "test")) throw new ToolError("EMAIL_CONFIG", "Invalid email provider; memory is test-only");
  if (provider === "resend" && !process.env.RESEND_API_KEY) return "ethereal";
  return provider;
}
// Getting the Ethereal account happens before any message leaves, so a failure here is a safe, retryable non-send.
async function etherealAccount() {
  g.normalEthereal ??= nodemailer.createTestAccount();
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out")), 15000));
  try { return await Promise.race([g.normalEthereal, timeout]); }
  catch (e) {
    g.normalEthereal = undefined;
    throw new ToolError("EMAIL_PROVIDER_UNAVAILABLE", `Could not open an Ethereal test inbox (${e instanceof Error ? e.message : e}); nothing was sent`, true, false);
  }
}
export async function sendEmail(input: { to: string; subject: string; body: string; key: string }) {
  const provider = emailProvider();
  if (provider === "memory" || provider === "demo") return { provider, providerOperationId: `${provider}_${randomUUID()}`, status: "accepted" as const };
  const account = provider === "ethereal" ? await etherealAccount() : undefined;
  try {
    if (provider === "resend") {
      // The drafted text can differ after a demo reset; Resend rejects a reused key with a changed body, so bind the key to the content. Duplicate protection for the same plan/recipient stays in the email_sends claim.
      const key = createHash("sha256").update(JSON.stringify([input.key, input.subject, input.body])).digest("hex");
      const r = await fetch("https://api.resend.com/emails", { method: "POST", signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify({ from: process.env.EMAIL_FROM || "onboarding@resend.dev", to: [input.to], subject: input.subject, text: input.body }) });
      if (!r.ok) {
        // A 4xx is a definite rejection (nothing sent), so it is safe to retry once the cause is fixed; a 5xx may have sent.
        const reason = await r.json().then(b => String(b?.message || ""), () => "");
        throw new ToolError("EMAIL_REJECTED", `Resend rejected send (${r.status})${reason ? `: ${reason}` : ""}`, r.status < 500, r.status >= 500);
      }
      const data = await r.json();
      if (!data.id) throw new ToolError("EMAIL_AMBIGUOUS", "Provider response missing operation ID", false, true);
      return { provider, providerOperationId: String(data.id), status: await getEmailStatus(String(data.id)) };
    }
    const transport = nodemailer.createTransport({ host: account.smtp.host, port: account.smtp.port, secure: account.smtp.secure, auth: { user: account.user, pass: account.pass }, connectionTimeout: 15000, socketTimeout: 15000 });
    const sent = await transport.sendMail({ from: process.env.EMAIL_FROM || account.user, to: input.to, subject: input.subject, text: input.body });
    if (!sent.accepted.length) throw new ToolError("EMAIL_REJECTED", "SMTP did not accept recipient");
    return { provider, providerOperationId: sent.messageId, previewUrl: nodemailer.getTestMessageUrl(sent) || undefined, status: "accepted" as const };
  } catch (e) {
    if (e instanceof ToolError) throw e;
    throw new ToolError("EMAIL_AMBIGUOUS", e instanceof Error ? e.message : "Email send uncertain", false, true);
  }
}
export async function getEmailStatus(id: string): Promise<"accepted" | "delivered"> {
  try {
    const r = await fetch(`https://api.resend.com/emails/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(5000), headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } });
    if (r.ok && (await r.json()).last_event === "delivered") return "delivered";
  } catch { /* Accepted is not a delivery claim. */ }
  return "accepted";
}

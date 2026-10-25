import "server-only";

/**
 * The investigator's LLM client. Every call goes through Mubit's Gemini route, so Mubit records each diagnosis as one
 * recurring task and can train an adapter from it. The Mubit key (`MUBIT_API_KEY`) is sent as `x-goog-api-key`.
 */
export const MUBIT_BASE_URL = "https://api.mubit.ai/gemini/v1beta";
export const MUBIT_MODEL = "gemini-4-argon";
const MUBIT_TIMEOUT_MS = 45_000;

export class InvestigatorError extends Error {
  constructor(message: string, readonly code: string, readonly status: number, readonly mubitRequestId?: string) { super(message); this.name = "InvestigatorError"; }
}

export interface MubitPrompt { system: string; user: string; maxTokens: number }
export interface MubitReply { content: string; model: string; mubitRequestId: string; inputTokens: number; outputTokens: number; latencyMs: number }

/** Gemini generateContent request for one system + user turn, JSON output, temperature 0 (same evidence → same answer). */
export function mubitRequest(prompt: MubitPrompt, apiKey: string) {
  const base = (process.env.MUBIT_BASE_URL || MUBIT_BASE_URL).replace(/\/$/, "");
  return {
    url: `${base}/models/${encodeURIComponent(MUBIT_MODEL)}:generateContent`,
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: {
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: "user", parts: [{ text: prompt.user }] }],
      generationConfig: { maxOutputTokens: prompt.maxTokens, responseMimeType: "application/json", temperature: 0 },
    },
  };
}

/** Calls Mubit once (one retry when Mubit answers 429/503) and returns the answer text with Mubit's request ID. */
export async function callMubit(prompt: MubitPrompt, fetchImpl: typeof fetch = fetch): Promise<MubitReply> {
  const apiKey = process.env.MUBIT_API_KEY;
  if (!apiKey) throw new InvestigatorError("The Mubit investigator is not configured (MUBIT_API_KEY is not set)", "mubit_not_configured", 503);
  const request = mubitRequest(prompt, apiKey);
  const init: RequestInit = { method: "POST", headers: request.headers, body: JSON.stringify(request.body) };
  const started = Date.now();
  let response: Response;
  try {
    response = await fetchImpl(request.url, { ...init, signal: AbortSignal.timeout(MUBIT_TIMEOUT_MS) });
    if (response.status === 429 || response.status === 503) {
      const wait = Math.min(5, Math.max(1, Number(response.headers.get("retry-after")) || 2));
      await new Promise((resolve) => setTimeout(resolve, wait * 1000));
      response = await fetchImpl(request.url, { ...init, signal: AbortSignal.timeout(MUBIT_TIMEOUT_MS) });
    }
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") throw new InvestigatorError(`Mubit did not answer within ${MUBIT_TIMEOUT_MS / 1000} s; no diagnosis was made. Please retry.`, "mubit_timeout", 503);
    throw new InvestigatorError("Mubit could not be reached; no diagnosis was made. Please retry.", "mubit_unavailable", 503);
  }
  const mubitRequestId = response.headers.get("x-middleware-request-id") ?? undefined;
  if (!response.ok) {
    // Provider bodies and credentials stay out of responses and logs.
    console.error(JSON.stringify({ event: "mubit_investigator_failed", status: response.status, mubitRequestId }));
    throw new InvestigatorError(`Mubit could not complete the diagnosis (HTTP ${response.status}). Please retry.`, "mubit_request_failed", 502, mubitRequestId);
  }
  if (!mubitRequestId || !/^mreq_[a-f0-9]{32}$/i.test(mubitRequestId)) throw new InvestigatorError("The answer did not carry a Mubit request ID, so it was not accepted", "mubit_invalid_response", 502);
  const data = (await response.json().catch(() => null)) as GeminiResponse | null;
  const candidate = data?.candidates?.[0];
  const content = (candidate?.content?.parts ?? []).filter((p) => !p.thought && typeof p.text === "string").map((p) => p.text).join("");
  if (!content.trim() || candidate?.finishReason !== "STOP") throw new InvestigatorError("Mubit returned an incomplete answer; no diagnosis was made. Please retry.", "mubit_invalid_response", 502, mubitRequestId);
  const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);
  const usage = data?.usageMetadata;
  return {
    content, model: typeof data?.modelVersion === "string" ? data.modelVersion : MUBIT_MODEL, mubitRequestId,
    inputTokens: count(usage?.promptTokenCount), outputTokens: count(usage?.candidatesTokenCount) + count(usage?.thoughtsTokenCount), latencyMs: Date.now() - started,
  };
}

interface GeminiResponse {
  candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  modelVersion?: string;
}

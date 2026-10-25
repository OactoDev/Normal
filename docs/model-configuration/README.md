# Gemini 4 Argon configuration

Normal is configured to use **Gemini 4 Argon (`gemini-4-argon`) through Mubit** for investigation, source support, diagnosis, solution planning and optional grounded research. The server defaults, local environment and `.env.example` agree. The application footer reads the same server-owned model settings; README and current documentation use the same name.

Gemini calls now use Mubit's native `generateContent` route, preserving Mubit request IDs, actual usage, recording controls and local output validation. OpenAI-compatible calls remain supported for explicit legacy model selections. No historical request or evaluation was relabelled as Gemini output.

Live checks passed for structured output, function calling and the actual investigation, diagnosis and planning output schemas. Larger upstream decoding schemas initially returned HTTP 400. The Gemini generation schema now omits string/array length bounds to reduce decoding complexity; the original Zod schema still enforces every limit, required field and extra-field rule locally. A unit case confirms oversized outputs are rejected. The first no-evidence investigation probe also failed local validation, and was preserved; the subsequent probe used the production investigator instructions and explicit competing hypotheses and passed. No automatic inference retry was added.

TypeScript and 56 focused provider, investigator, planner and training tests passed; focused ESLint passed. The old long-running investigation/planner workers were stopped gracefully, then restarted. Both reported Gemini 4 Argon at startup. The running Next.js server renders the model disclosure correctly. No full regression, production deployment or model-accuracy improvement is claimed.

See `verification.json`, the timestamped schema-probe artifacts, `gemini-connectivity.log`, and `current-model.png`. The synthetic checks used metadata-only recording and changed no business records. Grounded research remains configured to the same Gemini model; these checks did not rerun a live Google Search request.

API references: [Mubit Gemini connection](https://docs.mubit.ai/guides/connect-gemini), [Google generation/structured-output reference](https://ai.google.dev/api/generate-content).

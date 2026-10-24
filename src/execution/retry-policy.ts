export class ToolError extends Error {
  constructor(public code: string, message: string, public retryable = false, public sideEffectPossible = false, public status = 400) { super(message); }
}
export const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
export const stepDelay = () => delay(Number(process.env.EXECUTION_STEP_DELAY_MS ?? (process.env.NODE_ENV === "production" ? 0 : 600)));

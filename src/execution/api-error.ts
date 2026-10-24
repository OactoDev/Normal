import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { ZodError } from "zod";
import { ApiError } from "../contracts";
import { ToolError } from "./retry-policy";
export function apiError(error: unknown) {
  const status = error instanceof ToolError ? error.status : error instanceof ZodError || error instanceof SyntaxError ? 400 : 500;
  const code = error instanceof ToolError ? error.code : status === 400 ? "BAD_REQUEST" : "INTERNAL_ERROR";
  return NextResponse.json(ApiError.parse({ error: { code, message: error instanceof Error ? error.message : "Unexpected error", requestId: randomUUID() } }), { status });
}

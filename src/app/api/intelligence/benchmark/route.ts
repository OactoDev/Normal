import { NextResponse } from "next/server";
import { benchmarkEvaluator } from "../../../../intelligence/benchmark-evaluator";

export async function GET() {
  const summary = benchmarkEvaluator.runBenchmark();
  return NextResponse.json(summary);
}

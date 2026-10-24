import "server-only";

import { after } from "next/server";
import { describeDbError } from "@/lib/mongodb";
import { runMonitor } from "@/intelligence/monitor";

const AUTO_MONITOR_ATTEMPTS = 20;
const AUTO_MONITOR_BACKOFF_MS = 1_500;

/**
 * Schedules a monitoring scan after a successful simulator tick has been persisted and its response sent. Runs outside
 * the tick's lock and response path, so simulated purchases and ticks are never blocked. Enabled in development unless
 * NORMAL_AUTO_MONITOR=false; elsewhere only when NORMAL_AUTO_MONITOR=true. Repeated scans are idempotent and a
 * scan that finds the lock held retries with bounded backoff.
 */
export function scheduleAutoMonitor(businessId: string, simulationRunId: string): boolean {
  const flag = process.env.NORMAL_AUTO_MONITOR;
  const enabled = flag === "true" || (flag !== "false" && process.env.NODE_ENV === "development");
  if (!enabled) return false;
  try {
    after(async () => {
      // A scan already holding the lock (e.g. from the previous tick) delays this one; retry so the newest hour is
      // always analysed. Each attempt analyses the latest observed hour at that moment.
      for (let attempt = 0; attempt < AUTO_MONITOR_ATTEMPTS; attempt++) {
        try {
          await runMonitor({ businessId, simulationRunId });
          return;
        } catch (error) {
          const code = (error as { code?: string }).code;
          if (code === "monitor_locked") { await new Promise((r) => setTimeout(r, AUTO_MONITOR_BACKOFF_MS)); continue; }
          if (code !== "stale_window") console.error("[auto-monitor]", describeDbError(error));
          return;
        }
      }
    });
    return true;
  } catch {
    return false; // outside a request scope (e.g. direct handler invocation in tests)
  }
}

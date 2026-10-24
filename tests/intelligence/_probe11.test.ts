import { it } from "vitest";
import { writeFileSync, appendFileSync } from "node:fs";
import { EXPECTED_THEMES, HELD_OUT_SEEDS, HELD_OUT_ROUND_1, scoreHealthy, scoreScenario } from "@/intelligence/evaluation/evaluate";
const OUT = "/private/tmp/claude-501/-Users-oacto-Normal/fd2b8c14-0a0f-4388-94ca-dc3bc687bbd8/scratchpad/probe11.txt";
const log = (s: string) => appendFileSync(OUT, s + "\n");
it("held-out evaluation", () => {
  writeFileSync(OUT, "");
  for (const seed of [...HELD_OUT_SEEDS, ...HELD_OUT_ROUND_1]) { const h = scoreHealthy(seed, 24 * 10); log(`${HELD_OUT_SEEDS.includes(seed) ? "R2" : "R1"} HEALTHY ${seed} 10d: findings=${JSON.stringify(h.findings)} incidents=${h.incidents} worthy=${h.investigationWorthyIncidents}`); }
  for (const scenario of Object.keys(EXPECTED_THEMES) as Array<keyof typeof EXPECTED_THEMES>) {
    for (const seed of [...HELD_OUT_SEEDS, ...HELD_OUT_ROUND_1]) {
      const s = scoreScenario(scenario, seed);
      log(`${HELD_OUT_SEEDS.includes(seed) ? "R2" : "R1"} ${scenario} ${seed}: detected=${s.detected} delay=${s.detectionDelayHours}h first=${s.firstSignal} worthy=${s.investigationWorthy} title="${s.primaryIncidentTitle}" pre=${s.preInjectionFindings} off=${JSON.stringify(s.offTargetFindings)} inv=${s.inventoryRiskDetected} f=${s.totalFindings} i=${s.totalIncidents}`);
    }
  }
});

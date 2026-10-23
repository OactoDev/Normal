# Decisions

Short ADRs — date, decision, why. Newest at top.

## Template

```markdown
### YYYY-MM-DD — Title

- **Decision:** …
- **Why:** …
- **Track / demo impact:** …
```

---

### 2026-10-23 — Product Identity & Data Contracts: Normal
- **Decision:** Officially named the product **Normal** (“Making seamless operations the new normal”). Data contracts frozen in `src/contracts.ts` with 22 Zod schemas covering Business, Telemetry, Investigation, DiagnosisModelOutput, ActionExecution, Simulator, and Mubit Trace/Evaluation.
- **Why:** Elevates the tool from a forensic script into a comprehensive autonomous Business Intelligence and Operations platform. Normal continuously monitors company performance, isolates anomalies across 6 simulator scenarios (delivery delays, ad fatigue, checkout failures, negative reviews, etc.), proposes version-locked action plans, and uses Mubit to train task-adapted models from recurring merchant feedback.
- **Track / demo impact:** Locks Track 1 (Recurring tasks) and Track 3 (Fast refresh) around a rock-solid, production-grade schema. Live credentials verified across Mubit (`mbt_mw-app_...`) and Gemini (`AIzaSyC45...`) on both `/openai/v1` and `/gemini` gateways.

### 2026-10-23 — Sprout scope cut + Mubit-latency-first

- **Decision:** Keep Sprout over the HackForge picks (Escalation Conflict Review, Extraction Provenance Register), but narrow it to **one recurring task**: incident bundle (orders, checkout errors, shipping/supplier events, coupon logs) → JSON `{root_cause, evidence_rows, remediation_action}`. Seeded *Nice Pieces* store with ~6 root-cause types and ~40 incidents, with a **held-out set sealed before any feedback**. Cut autonomous cross-silo remediation, live Shopify integration, and multi-agent setups. Lead with **Track 1**; Track 3 appears only as a sub-beat (a new failure mode appears and the update keeps pace).
- **Why:** Demo and usefulness together are 50% of judging, and "revenue dropped, find the culprit" reads instantly. HackForge's pick has inferred demand and high delivery risk, and its red team called the backup "extraction review plus an audit log". A narrow classification + extraction task maps corrections cleanly onto adapter updates and fits 2 people by Sun 10:00.
- **First (Fri, before 23:00):** Verify that Mubit's correction → adapter update actually activates, and measure the latency (one hello-world call + one feedback submission). Ask Mubit office hours at kickoff. If updates take hours: pre-train one adapter version overnight, demo the version switch live, and show a fresh correction being queued.
- **Track / demo impact:** Scoreboard on the held-out set compares **baseline vs prompt-fix baseline vs Mubit-adapted** (this answers "why not just fix the prompt?"). Demo arc (<3 min): revenue counter drops → AI blames ads (wrong) → reviewer corrects cause + policy ("supplier SLA breach → store credit, not cash refund") → Mubit version bumps → unseen incident diagnosed right with zero edits → scoreboard moves. Checkpoints: Sat midday baseline number; Sat night adapted beats both baselines; Sun 08:00 timed dry run + backup MP4/MOV (≤3 min) + PDF deck.

### 2026-10-23 — Project Concept Selection: Sprout (Autonomous E-Commerce Forensics & Revenue Recovery)

- **Decision:** Build **Sprout** (Autonomous E-Commerce Forensics & Revenue Recovery) rather than the prompt injection security layer. Target Tracks: **Track 1: Recurring tasks** and **Track 3: Fast refresh**.
- **Why:** Prompt injection security is too niche, hard to verify without synthetic jailbreaks, and lacks a natural recurring human correction loop. Sprout solves a high-value operational problem (margin collapse caused by cross-silo supplier/fulfillment delays) where merchant corrections directly train task-specific Mubit model adapters to enforce brand policies.
- **Track / demo impact:** Directly satisfies the 25% "Use of Mubit" criteria with a live, observable `correction → Mubit adapter update → held-out evaluation` sequence on simulated brand telemetry (*Nice Pieces*).


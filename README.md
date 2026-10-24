# Normal

AI agents that run an online shop's operations, and check their own diagnosis against the merchant's policy before any money is spent.

| | |
|--|--|
| **Live app** | [normal-ops.kiritokris.workers.dev](https://normal-ops.kiritokris.workers.dev) |
| **Technical demo** | [normal-technical-demo.mp4](https://github.com/OactoDev/Normal/releases/download/demo-videos/normal-technical-demo.mp4) (1:44) |
| **Ad** | [normal-ad.kiritokris.workers.dev](https://normal-ad.kiritokris.workers.dev) (0:28) · [download](https://github.com/OactoDev/Normal/releases/download/demo-videos/normal-ad.mp4) |

## How it works

1. **Detect.** Normal spots an anomaly in the shop's telemetry (late deliveries, rising ad costs, bad reviews) and collects the evidence.
2. **Diagnose.** Gemini 4 Argon, called through Mubit, names the root cause. The answer streams in as it is written.
3. **Verify.** [Banyan Sapling](https://huggingface.co/MubitLabs/banyan-sapling) checks the diagnosis against the merchant's policy and the evidence it cites. A violation, missing evidence or contradictory evidence blocks the plan. The server runs the check again when a plan is requested, so the browser can't skip it.
4. **Plan and approve.** Gemini 4 Argon, through Mubit, writes the recovery plan for the marketing, customer care and storefront agents. The server checks every action against the store's rules (budget cap and change limit, real delayed orders, cited evidence, no discount or refund promises) and rejects the whole plan if one fails. The merchant approves what's left.
5. **Execute.** Approved actions run, and each result is read back and verified.

## How Normal uses Mubit

Every model call goes through Mubit to `gemini-4-argon`, and each kind of call is its own Mubit task, so Mubit can train a separate adapter for it:

| Mubit task | What it does |
|--|--|
| Root-cause diagnosis | Names the cause from the evidence, temperature 0; streamed through `streamGenerateContent`. Merchant corrections ride along as labelled examples. |
| Recovery planning | Writes the plan's actions inside the store's limits. |
| Customer email drafts | Writes the delay paragraph. The customer's name never goes to Mubit; the template adds the greeting. |
| Case writer and blind checker | `scripts/mubit-case-factory.ts` writes training incidents and keeps only those a blind check agrees with; `scripts/mubit-replay.ts --cases` sends them to the diagnosis task. |

Health checks (`scripts/mubit-smoke.ts`) send `x-middleware-record: off`, so they never become training data. The Intelligence tab lists every Mubit call by task with its request ID and the model Mubit reports, so an adapter would show there if Mubit starts serving one. `scripts/mubit-capabilities-evidence.ts` re-runs the live checks and logs every request ID.

## Run locally

```bash
npm install
cp .env.example .env   # set MUBIT_API_KEY (model: gemini-4-argon via Mubit)
npm run dev            # http://localhost:3000
npm run test:sapling   # live Banyan Sapling checks
npm run test:planner && npm run test:streaming   # planner rules, streaming (Mubit mocked)
```

Built at Night Shift (Mubit, London 2026).

## Deploy to Cloudflare Workers

The public demo runs on Cloudflare Workers, with D1 storage and separate browser sessions. Hosted ads, storefront updates and emails are simulated; Sapling checks are live. See [deployment instructions](deployment/README.md).

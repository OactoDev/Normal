# Normal

AI agents that run an online shop's operations, and check their own diagnosis against the merchant's policy before any money is spent.

| | |
|--|--|
| **Live app** | [normal-ops.kiritokris.workers.dev](https://normal-ops.kiritokris.workers.dev) |
| **Technical demo** | [normal-technical-demo.mp4](https://github.com/OactoDev/Normal/releases/download/demo-videos/normal-technical-demo.mp4) (1:44) |
| **Ad** | [Watch the ad](https://claude.ai/artifact/GtFbfZtLQEdyqm31RjGdHk) (0:28) · [download](https://github.com/OactoDev/Normal/releases/download/demo-videos/normal-ad.mp4) |

## How it works

1. **Detect.** Normal spots an anomaly in the shop's telemetry (late deliveries, rising ad costs, bad reviews) and collects the evidence.
2. **Diagnose.** A Mubit-routed model names the root cause.
3. **Verify.** [Banyan Sapling](https://huggingface.co/MubitLabs/banyan-sapling) checks the diagnosis against the merchant's policy and the evidence it cites. A violation, missing evidence or contradictory evidence blocks the plan. The server runs the check again when a plan is requested, so the browser can't skip it.
4. **Plan and approve.** Marketing, customer care and storefront agents propose actions. The merchant approves them.
5. **Execute.** Approved actions run, and each result is read back and verified.

## Run locally

```bash
npm install
cp .env.example .env   # set MUBIT_API_KEY, MUBIT_BASE_URL, MUBIT_MODEL
npm run dev            # http://localhost:3000
npm run test:sapling   # live Banyan Sapling checks
```

Built at Night Shift (Mubit, London 2026).

## Deploy to Cloudflare Workers

The public demo runs on Cloudflare Workers, with D1 storage and separate browser sessions. Hosted ads, storefront updates and emails are simulated; Sapling checks are live. See [deployment instructions](deployment/README.md).

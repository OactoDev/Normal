# Policy Challenge entry — ready-to-post drafts

**Deadline: Sat 24 Oct 2026, 14:00 BST.** Post on X and LinkedIn, then put both post links in `#side-quests`. These are drafts; publishing remains with Efi.

**Attach the video:** `Normal_Sapling_Quest.mp4` in this folder. The demo uses Efi's ElevenLabs voice and face, live supported/blocked runs, and four real Sapling stress checks. Final verification: `verification/video-report.json`.

**Repo:** https://github.com/OactoDev/Normal/tree/sapling-quest

## X (tag @MubitLabs)

> An AI can cut your ad budget. But did it get the diagnosis right?
>
> Normal checks first with @MubitLabs Banyan Sapling.
>
> 4 live checks: supported, violation, missing evidence, contradictions. 8 late orders vs a 10-order rule? Plan blocked.
>
> Watch the demo ↓

Attach the MP4. Put the repo link in a reply:

> Code + reusable demo pipeline: https://github.com/OactoDev/Normal/tree/sapling-quest

## LinkedIn (tag Mubit)

> What happens when an AI stops giving advice and starts spending your money?
>
> At the Night Shift hackathon, we built Normal: AI agents that run e-commerce operations. When sales drop, Normal diagnoses why, then builds a recovery plan for marketing, customer care and the storefront.
>
> Every action trusts that diagnosis. So before a plan is generated, Mubit's Banyan Sapling checks three things: the merchant's own policy, the evidence the diagnosis cites, and its claim.
>
> The attached demo shows two live runs:
>
> • 14 late orders, with a policy requiring at least 10 → supported. A plan can proceed to merchant approval.
> • 8 late orders → violation. The plan is blocked and the button locks.
>
> Then we stress-test Sapling with four real API checks: supported evidence, a threshold violation, missing delivery records with only ad data, and contradictory reports about the same orders. The UI shows every label's probability and the actual latency, alongside the expected and returned verdicts.
>
> The server checks again when a plan is requested. A forged browser-side pass cannot bypass a blocking verdict: the request returns HTTP 409. Unavailable or malformed Sapling responses also block a plan. A human still approves every plan before execution.
>
> We expose Sapling's conservative calibrated status as well as its raw label. When the calibrated status is "unsure", the gate uses the raw label; these are model classifications, not guarantees of correctness.
>
> Repo: https://github.com/OactoDev/Normal/tree/sapling-quest
>
> #NightShift #AI #ecommerce

Attach `Normal_Sapling_Quest.mp4` and select Mubit from LinkedIn's mention picker.

## #side-quests message

> Team: Normal
> Task: Banyan Sapling checks Normal's root-cause diagnosis against the merchant's policy and cited evidence before a recovery plan is built. The demo shows supported/blocked runs plus four live checks for support, violation, missing evidence and contradictory evidence; the server rechecks before plan generation.
> X: <paste published X post link>
> LinkedIn: <paste published LinkedIn post link>
> Repo: https://github.com/OactoDev/Normal/tree/sapling-quest

## Reproduce the video

From the Team repository, with `normal-demo` running on port 3100:

```bash
demo-recording/pipeline/make_video.sh demo-recording/pipeline/scenes.json "$HOME/Downloads/Movie on 24-10-2026 at 12.35.mov" demo-recording/sapling/Normal_Sapling_Quest.mp4
```

The pipeline README covers dependencies, cached audio, individual stages, and the `--no-lipsync` fallback. Credentials are read from `~/.config/elevenlabs/` and never committed.

## Live checks before recording

The four stress cases were curled live and returned all four expected labels. Probabilities vary; the recorded UI is authoritative for that run. Parallel requests can queue at the provider, so the narration makes no fixed latency promise.

1. Intelligence → **14 late orders · test pass** → **Run Mubit AI Diagnosis** → supported; generate a plan and show merchant approval without approving or executing it.
2. Intelligence → **8 late orders · test block** → diagnosis → violation; plan button disabled.
3. **Stress-test Sapling (4 live checks)** → compare the expected and actual verdicts, probabilities and latency.
4. `npm run test:sapling` verifies real Sapling responses and that plan generation refuses a forged pass.

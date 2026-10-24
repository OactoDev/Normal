# Policy Challenge entry — drafts

**Deadline: Sat 24 Oct, 14:00 BST.** Post on X and LinkedIn first, then in `#side-quests`.

Attach: `blocked-violation.jpg` (main image) and `supported.jpg`. A 60–90 s screen recording of the two runs is better if there's time (see "Demo run" below).

Before posting: commit and push the Sapling work so the repo link shows it, and make sure the repo is public.

---

## X (tag @MubitLabs)

> An AI says "delivery delays", so Normal's agents cut ad spend and email customers.
>
> First, @MubitLabs Banyan Sapling checks that diagnosis against the shop's policy and evidence.
>
> 8 late orders vs a 10-order rule → violation (99%). Plan blocked before money moves.

(Repo link as a reply, to stay under 280 characters.)

## LinkedIn (tag Mubit)

> At the Night Shift hackathon we built Normal: AI agents that run e-commerce ops. When revenue drops, Normal diagnoses why, then marketing, customer care and storefront agents act on it: cutting ad budgets, emailing customers, changing the shop.
>
> The risk: everything downstream trusts the diagnosis. If the AI says "delivery delays" on thin evidence, real money moves for the wrong reason.
>
> So before any plan is generated, Mubit's Banyan Sapling checks the diagnosis against the merchant's own policy and the evidence it cites:
>
> • 14 orders late, rule needs 10 → supported. The plan goes to the merchant for approval.
> • 8 orders late → violation (99%). Plan blocked, button disabled.
> • Diagnosis cites only ad data → insufficient information. Blocked.
>
> The check also runs on the server when the plan is requested, so a client can't skip it by claiming "supported".
>
> Sapling's calibrated status is deliberately conservative and is often "unsure". We show it next to the verdict and gate on Sapling's top label, so a human still approves every plan that passes.
>
> Repo: https://github.com/OactoDev/Normal/tree/sapling-quest
>
> #NightShift #AI #ecommerce

## #side-quests message

> Team: Normal
> Task: Banyan Sapling checks an AI's root-cause diagnosis against the merchant's policy and evidence before Normal's agents spend money on it; a violation or missing evidence blocks the plan (8 late orders vs a 10-order rule: violation, 99%).
> X: <X post link>
> LinkedIn: <LinkedIn post link>
> Repo: https://github.com/OactoDev/Normal/tree/sapling-quest

---

## Demo run (for a recording)

1. `Intelligence` tab → scenario `delivery_delays`, severity 85% → Inject → Run Mubit AI Diagnosis → Banyan Sapling card shows **supported**; plan button is live.
2. Severity 15% → Inject → Run diagnosis → **violation · ~99%**, red "Plan blocked" panel, button reads "Blocked by Banyan Sapling".
3. Optional: run `npm run test:sapling` in a terminal to show the live verdicts and the forged-"supported" refusal.

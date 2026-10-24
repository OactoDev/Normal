# Discord capture — #side-quests — Policy Challenge entries (as of 10:28 BST)

- **Captured:** 2026-10-24 ~12:05 BST (pasted by Efi from Discord)
- **Quest:** Banyan Sapling "Policy" Challenge — closes **Sat 24 Oct 14:00 BST** ([rules](2026-10-24-0216-everyone-side-quest-policy-challenge.md))

| # | Team | What Sapling checks | Against | Headline result | Repo |
|---|------|--------------------|---------|-----------------|------|
| 1 | Fox | What a coding agent *reports* | Tool outputs it actually saw | Caught a changed figure in an HMRC letter (p=0.86) | [foxreymann/mubit-sapling-trace-auditor](https://github.com/foxreymann/mubit-sapling-trace-auditor) |
| 2 | Noire | Compliance docs (e.g. NDAs) | Clauses / policies | — (explainer post) | [ZakZerari/Mubit-Sapling](https://github.com/ZakZerari/Mubit-Sapling) |
| 3 | tokenStack | Support-agent *actions* before they run | Written policy + records seen | τ-bench, 1,002 actions: 0 of 57 rule breaks got through; live demo | [faveh/agent-guard](https://github.com/faveh/agent-guard) |
| 4 | HookLine | ETH/BTC wallet evidence (8 rules) | Written AML policy → FLAG/REVIEW/CLEAR | Live demo (chainsentinel-aml.vercel.app) | [Ibad-10/Chainsentinel](https://github.com/Ibad-10/Chainsentinel) |
| 5 | Tibum | AI's "just a refactor" claim on COBOL | Policy + Z3 proof of the real change | Caught doubled bonus (0.92), merge blocked; live portal | [atiladeokegab/sapling-cobol-gate](https://github.com/atiladeokegab/sapling-cobol-gate) |
| 6 | gitHappens | Patient medicines list | Every care chart | Flags stopped/missing/wrong-dose meds; via Mubit gateway | [esh1306/medmatch](https://github.com/esh1306/medmatch) |

## Patterns

- **Claim vs evidence** (1, 5) and **action vs policy before execution** (3) are taken, and both have strong numbers or a live demo.
- Each entry has: one realistic incident as the hook, a Sapling score, a live demo or real dataset, and posts on both X and LinkedIn.
- Nobody uses Sapling's `insufficient_information` verdict as a feature in its own right. Nobody gates *money being spent* on a business diagnosis, and nobody ties a Sapling verdict to Mubit's correction → model update loop.

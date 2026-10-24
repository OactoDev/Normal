# Normal demo: narration script (about 2 min)

Voice: ElevenLabs 'Daniel' (premade), model eleven_multilingual_v2, speed 1.12. Timestamps are when each scene starts in Normal_Demo_Narrated.mp4.

## [0:00] Intro (Intelligence tab)

This is Normal, running on a simulated Nike business. Its intelligence side detects problems and diagnoses root causes using Mubit. My part starts once a plan exists: turning it into real, verified actions.

## [0:17] Plan review

Here's a plan it produced. The diagnosis is delivery delays, with ninety-four percent confidence, backed by evidence: twelve parcels breached their promise, and acquisition cost nearly doubled. There are three actions: cut Campaign A's budget from fifty to thirty pounds, email customers with delayed orders, and publish a delivery banner. Each one shows its agent, its risk, and its rationale.

## [0:45] Before state (Ads Manager + store)

First, the starting state. Campaign A spends fifty pounds a day, so one fifteen-minute tick spends fifty-two pence. And the store has no banner.

## [0:57] Approval and safety checks

Nothing runs without explicit approval. The owner approves all, some, or none, and the backend checks the business, plan version, expiry, and permissions. Then we execute.

## [1:11] Mission Control (agents running)

Each specialist agent gets its own mission. Marketing changes the budget. Customer Care drafts personalised notices through Mubit, and sends them to a test inbox. Storefront publishes the banner. Independent actions run together, and idempotency keys prevent duplicate sends.

## [1:31] Verified results

Success only counts after a read-back. The budget reads thirty pounds. The banner is confirmed active. Both emails went out through Resend, and Resend itself reports them as delivered. And every record is stored, and survives a restart.

## [1:49] After state (Ads tick + store banner)

Now the proof. Campaign A is at thirty pounds, and the next tick spends thirty-one pence instead of fifty-two, so future ad behaviour really changed. And the store shows the banner.

## [2:03] Close

Plan, approve, execute, verify, record. Permission-checked at every step, with nothing done on an AI's say-so. Next, the results flow back to the intelligence pipeline.

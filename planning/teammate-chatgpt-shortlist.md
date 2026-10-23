# Teammate & ChatGPT Shortlist: Top 10 Novel Concepts for Night Shift Mubit

Source: Teammate proposal & ChatGPT deep research synthesis for $65K Night Shift Hackathon (London, Canary Wharf).

## Core Shortlist Candidates

### 1. Revenue CSI — The AI Revenue Detective (Top Pick)
- **Tagline**: "Your store made £8,000 less than expected yesterday. Something killed your conversions. Find the culprit."
- **Primary User**: E-commerce companies, SaaS businesses, growth teams, and payment operations.
- **Workflow**: 
  - An e-commerce brand's conversion rate or daily sales plunges unexpectedly.
  - The AI investigates sales funnels, shipping delays, checkout failures, coupon bugs, or payment gateway rejections.
  - Identifies the root cause (e.g. supplier shipping delay of 28 days causing cancellations; or a broken mobile checkout script).
- **Mubit Learning Loop**:
  - The model initially diagnoses an incorrect cause (e.g. blaming ad quality).
  - An operations manager corrects the diagnosis and policy action (e.g. pointing to supplier SLA breach and specifying store credit instead of cash refund).
  - Mubit captures the correction and updates the task-specific root-cause / remediation model adapter.
  - On fresh, unseen incidents with different clues, the updated model diagnoses correctly with zero human edits.
- **Killer Demo**: Live revenue counter falls visibly $\rightarrow$ AI investigates suspects $\rightarrow$ human reviewer corrects interpretation $\rightarrow$ Mubit updates model version $\rightarrow$ unseen incident resolves correctly $\rightarrow$ simulated remediation restores checkout/sales.

### 2. Reality Compiler — Software That Checks Itself Against Reality
- **Tagline**: "Documentation becomes outdated the moment software changes. Reality Compiler continuously tests what your documentation claims against what your code actually does."
- **Primary User**: Software engineering teams, API providers (Stripe, Vercel), developer platforms.
- **Workflow**:
  - Code changes introduce subtle breaking changes to methods, signatures, or endpoints.
  - Documentation and examples still recommend old methods.
  - The compiler runs executable checks embedded in docs against the new code.
- **Mubit Learning Loop**:
  - The model classifies whether a code diff invalidates public user-facing documentation claims vs. internal refactors.
  - Engineers correct misclassifications (e.g. "this is internal, don't flag" vs "this breaks public snippet").
  - Mubit updates the doc-invalidation adapter.
- **Killer Demo**: A breaking code change is merged $\rightarrow$ embedded doc test turns red $\rightarrow$ engineer corrects the classification $\rightarrow$ Mubit updates model $\rightarrow$ patch generator fixes the docs and the live test turns green.

### 3. Launch Roulette — Test the Future Before Deploying
- **Tagline**: "Every deployment is a gamble. Launch Roulette learns which tests catch the most dangerous failures before they reach your customers."
- **Primary User**: Engineering teams, CI/CD platforms, startups with limited test budgets.
- **Workflow**:
  - A pull request is opened, but the team only has a 10-minute CI budget and 40 expensive tests.
  - The agent predicts which tests are most likely to expose regressions.
- **Mubit Learning Loop**:
  - Initial model misses an integration test; deployment causes simulated production outage.
  - Developer marks the test as essential for this class of dependency.
  - Mubit adapts the test-selection model.
  - On a fresh PR, the adapted model prioritizes the right test and catches the bug before deploy.
- **Killer Demo**: PR merged $\rightarrow$ Deploy pressed $\rightarrow$ simulated production crash $\rightarrow$ Mubit adapter updated $\rightarrow$ new PR $\rightarrow$ correct test selected, disaster averted.

---

## Additional Shortlist Ideas Evaluated

4. **FraudShift**: Scam detection adapting to emerging attack patterns (Fast Refresh track).
5. **ShadowSec**: Security PR reviewer learning recurring codebase vulnerabilities.
6. **CourierBrain / LastBolt**: Logistics exception agent resolving missing parts & delivery fleet disruptions.
7. **AgentForge**: Meta-orchestrator learning optimal tool & specialist agent routing.
8. **ContractDNA / Clause Domino**: Contract review predicting cascading financial & operational risks.
9. **GridShift**: Cloud rightsizing & carbon-aware workload migration.
10. **GhostBuyer**: Lead qualification simulator learning from customer objections.

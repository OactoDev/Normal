<img width="8931" height="3240" alt="header-3" src="https://github.com/user-attachments/assets/80916a0e-baf5-40fa-b5b5-7ccf4f6ab7c3" />

# The Problem
Small ecommerce businesses struggle to identify and resolve revenue-impacting problems because their operational data is fragmented across multiple platforms, leaving owners to manually investigate issues and coordinate solutions.

# What is Normal?

Normal is a Business Intelligence and Operations platform that continuously monitors company performance and actively identifies underlying problems or growth opportunities, co-ordinating AI Agents tasked to take corrective action.

Traditional business analytics platforms tell owners what is happening through dashboards, reports and performance metrics. Normal goes further by understanding why changes may be happening and what actions could improve the situation.

When Normal detects a significant change, such as declining revenue, increasing acquisition costs, deteriorating customer sentiment or unexpectedly strong product demand, it initiates an autonomous investigation.

Normal retrieves relevant evidence, evaluates possible explanations and produces a prioritised action plan. Once the business owner approves the plan, Normal orchestrates specialised agents capable of carrying out tasks across the connected platforms.

At the centre of Normal is a continuously improving intelligence layer powered by Mubit. Rather than repeatedly relying on general-purpose LLMs for identical decisions, Normal uses Mubit to develop task-adapted models from recurring workloads and feedback.
How Normal uses Mubit
Mubit is what allows Normal to turn recurring business decisions into specialised AI intelligence.

Normal uses AI to diagnose business problems, decide which actions are appropriate and coordinate agents. Mubit sits between Normal and its LLM providers, records repeated AI tasks and uses eligible examples to train smaller, task-specific model adapters. 

The goal is for Normal to become increasingly effective at understanding the types of problems businesses encounter repeatedly.

**Running today, from anomaly to diagnosis:** the simulator's events are monitored, the detector opens an investigation, read-only tools collect evidence, and the [Mubit investigator](src/intelligence/investigator/diagnose.ts) diagnoses it. Its [client](src/intelligence/investigator/mubit.ts) sends every call to Mubit's Gemini route (`https://api.mubit.ai/gemini/v1beta`, model `gemini-4-argon`, temperature 0) with `MUBIT_API_KEY`. The answer must match the shared `DiagnosisModelOutput` contract and cite only evidence that was sent, or nothing is saved. In the investigation workspace, press **Collect evidence**, then **Run Mubit diagnosis**: you get competing hypotheses with supporting and contradicting evidence, plus the Mubit request ID.

# Architecture Flowchart

<img width="5760" height="3240" alt="Architecture-2" src="https://github.com/user-attachments/assets/7fe85851-bedc-466a-84c1-6ab2cc665fc5" />

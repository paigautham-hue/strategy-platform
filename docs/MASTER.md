# MASTER.md — Strategy Platform Source of Truth

> The single canonical "where are we?" document. Updated **in the same PR** as any major change (per the named-file rule in [CLAUDE.md](./CLAUDE.md)).
>
> If this doc is more than 14 days stale at the time of a major shipping change, treat that as a bug and fix it.

---

## Header Metadata

| | |
|---|---|
| **Generated / Last Major Update** | 2026-05-20 (new repo initialized; clean-slate scaffold) |
| **Version** | v0.0.0-design (no code yet — to be built on Manus AI, deployed on Manus infra) |
| **Current Phase** | Phase 0 (Foundation) — not yet started; awaiting Manus build |
| **Deployment URL** | none (not deployed) |
| **Repository** | [paigautham-hue/strategy-platform](https://github.com/paigautham-hue/strategy-platform) (private) |
| **Branch** | `main` |
| **Last commit at update time** | initial commit |
| **Build platform** | Manus AI (to be configured) |
| **Reference repos** | [paigautham-hue/MiroFish](https://github.com/paigautham-hue/MiroFish) (private; prior design history + MiroFish engine code for pattern reference); [paigautham-hue/meridian](https://github.com/paigautham-hue/meridian) (private; voice + agentic patterns adapted into CLAUDE.md) |

---

## Status Legend (used across all docs in this folder)

| Symbol | Meaning |
|---|---|
| ☐ | not started |
| 🟡 | in progress |
| ✅ | done |
| ⛔ | blocked |
| 🔄 | needs revision |
| 🧊 | deferred (see [DEFERRED_BACKLOG.md](./DEFERRED_BACKLOG.md)) |

---

## Index of Documents

| Doc | Purpose | Length | Audience | Living? |
|---|---|---|---|---|
| [GUIDING_PRINCIPLES.md](./GUIDING_PRINCIPLES.md) | North star, 8 non-negotiables (P1-P8), 12 heuristics (H1-H12), explicit non-builds | ~9 KB | Anyone joining the project | Quarterly revision |
| [CLAUDE.md](./CLAUDE.md) | Project conventions, 18 Critical Patterns (C1-C18), Known Bug Patterns catalog, ultra-review protocol | ~17 KB | Every coding agent | Append on every bug fix |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Phase-by-phase plan, deliverables, acceptance gates, open decisions | ~51 KB | Implementation lead | Updated per phase milestone |
| [UX_DESIGN.md](./UX_DESIGN.md) | 12 design principles (DP1-DP12), 13 surfaces specified, design system, signature elements | ~43 KB | Designer + any frontend work | Quarterly revision |
| [MEMORY_AND_LEARNING_REVIEW.md](./MEMORY_AND_LEARNING_REVIEW.md) | Robustness audit: 50+ edge cases + 12 external techniques + 9 anti-patterns | ~26 KB | Before any work on memory or learning subsystems | Re-run when memory/learning architecture changes |
| [DEFERRED_BACKLOG.md](./DEFERRED_BACKLOG.md) | 13 sections of deferred items with promotion criteria, Won't-Build list | ~17 KB | Anyone proposing a feature | Append on every defer + promote |
| **MASTER.md** (this file) | Current state, recent changes, feature status, open decisions | ~12 KB | Anyone returning to project | **Updated on every major change** |

---

## Phase Status

| Phase | Title | Status | Started | Completed | Gate met? | Notes |
|---|---|---|---|---|---|---|
| **0** | Foundation, Outcome Capture, Cost Discipline | ☐ | — | — | — | Awaiting OD1-OD4, OD8 decisions |
| **1** | Memory, Ingest, Voice Intake, Hygiene Crons | ☐ | — | — | — | Blocked by Phase 0 |
| **2** | Diagnosis + Research Mesh + Code Interpreter | ☐ | — | — | — | Blocked by Phase 1 |
| **3** | Reasoning Mesh + Simulation + Cross-Co War-Game | ☐ | — | — | — | Blocked by Phase 2 |
| **4** | Brainstorm Mode + Multimodal + Realtime Voice + Distill | ☐ | — | — | — | Blocked by Phase 3 |
| **5** | Strategy → Execution + Operator UX Tier | ☐ | — | — | — | Blocked by Phase 4 |
| **6** | Learning Loop Activates | ☐ | — | — | — | Needs ≥ 20 closed predictions |
| **7** | Portfolio + Synergy + Voice Briefing | ☐ | — | — | — | Needs ≥ 3 portcos onboarded |
| **8** | Harden, Optimize, On-Prem Lane | ☐ | — | — | — | Final |

**Currently active workstream:** none — design phase complete, awaiting OD1-OD4 decisions to begin Phase 0.

---

## Feature Status Matrix

Tracks the headline capabilities of the platform. Updated as features ship.

| Capability | Phase | Status | Notes |
|---|---|---|---|
| Multi-company namespacing | 0 | ☐ | Tenant / Company / Project / Session models |
| LLM router + MCP gateway | 0 | ☐ | Text/embed only; realtime separate (Phase 4) |
| Prediction ledger | 0 | ☐ | Captures every claim from day one |
| Dimensional memory schema | 0 | ☐ | 13 dimensions per MemoryItem |
| Cost dashboard | 0 | ☐ | Per-user / per-company / per-session |
| PII redaction at ingest | 0 | ☐ | Runs before every LLM call |
| Per-portco encrypted export | 0 | ☐ | Full archive download |
| Audit log + usage instrumentation | 0 | ☐ | Required for phase-gate verification |
| Universal ingest (PDF, DOCX, audio, video, image, URL) | 1 | ☐ | Multimodal extraction |
| GraphRAG with dimensional auto-tagging | 1 | ☐ | Inferred at write time |
| Voice intake (one-shot) | 1 | ☐ | Whisper + strict-JSON intent parser |
| Portco onboarding wizard | 1 | ☐ | ≤ 30 min end-to-end |
| Decay / consolidation / dedup crons | 1 | ☐ | Memory hygiene from this phase |
| User + global memory layers | 1 | ☐ | GP preferences + framework canon |
| Diagnosis agent | 2 | ☐ | Reframes question before frameworks |
| Chief Strategist orchestrator | 2 | ☐ | Hierarchical dispatch + budgets |
| 8 research specialist agents | 2 | ☐ | Parallel within $5 budget |
| Live deep-research view | 2 | ☐ | Agents working visualization |
| Code interpreter (financial modeling) | 2 | ☐ | Sandboxed (OD11) |
| Contradiction review UI | 2 | ☐ | Open contradictions → 4 resolution states |
| **Share-and-Apply (Strategy Replication)** | 2 | ☐ | External artifact → portco application |
| 8-framework library (system-selected) | 3 | ☐ | Porter, Ansoff, JTBD, Wardley, 3H, BCG, Blue Ocean, Disruption |
| Option generator + MCDA + sensitivity | 3 | ☐ | Ensemble vote across 3 models |
| Red-team / critic ensemble | 3 | ☐ | Claude + GPT-5 + Gemini diversity |
| 4-arena simulation (customer / talent / capital / regulator) | 3 | ☐ | Extends OASIS dual-platform |
| Cross-company war-game (GP only) | 3 | ☐ | Permissioned 3-layer |
| TTS war-game playback | 3 | ☐ | ElevenLabs per persona |
| WebRTC realtime voice | 4 | ☐ | OpenAI Realtime / Gemini Live abstraction |
| Brainstorm Mode (4 phases) | 4 | ☐ | Diverge → Probe → Sharpen → Lock |
| Voice mini-player (persistent) | 4 | ☐ | Decoupled from full overlay (C14) |
| Persona swap mid-session | 4 | ☐ | "Let me hear from the regulator" |
| Vision-in (slides, whiteboards, charts) | 4 | ☐ | Vision model extracts to structured |
| Image-out (Wardley, Porter, BCG, 3H) | 4 | ☐ | Imagen 4 / Flux (OD9) |
| Memo dictation | 4 | ☐ | One-shot → 1-page memo |
| Hot-path distillation | 4 | ☐ | ≥ 5× cost reduction on extraction/classification |
| Strategy decomposer (Initiative → OKR → Task) | 5 | ☐ | With pre-mortem launch ritual |
| Linear connector (bi-directional) | 5 | ☐ | First execution tool |
| Notion connector | 5 | ☐ | Second |
| Jira connector | 5 | ☐ | Third |
| KPI sync (Stripe, GA4, Salesforce, Warehouse) | 5 | ☐ | Auto-map to OKR key results |
| Drift detectors (Schedule / KPI / Thesis) | 5 | ☐ | With replan engine |
| Operator-tier UX (Slack + Notion + Linear embed) | 5 | ☐ | 1-page memo default |
| Calibration cron + scorecard | 6 | ☐ | Per-framework × dimension × model |
| Pattern mining + Playbook engine | 6 | ☐ | Auto-draft after ≥ 3 evidence projects |
| Causal-lite attribution | 6 | ☐ | Post-mortem with counterfactual |
| Anti-hallucination memory audit | 6 | ☐ | Nightly sampling |
| 9-axis Synergy Scout | 7 | ☐ | Capability, customer, supplier, channel, geo, talent, tech, capital, macro |
| Pattern distillation (anonymized) | 7 | ☐ | Min N=3 portcos before cross-co publication |
| Portfolio dashboard (GP only) | 7 | ☐ | Thesis health, synergy queue, calibration |
| Voice briefing (daily / weekly) | 7 | ☐ | Podcast-style with chapter markers |
| Performance + cost optimization | 8 | ☐ | P95 latencies + numeric cost SLO |
| On-prem model lane | 8 | ☐ | vLLM with Llama 4 / DeepSeek / Qwen |

---

## Connector Inventory

| Connector | Phase | Direction | Status |
|---|---|---|---|
| Linear | 5 | bi-directional | ☐ |
| Notion | 5 | bi-directional | ☐ |
| Jira | 5 | bi-directional | ☐ |
| Stripe | 5 | read-only | ☐ |
| Google Analytics 4 | 5 | read-only | ☐ |
| Salesforce / HubSpot | 5 | read-only | ☐ |
| Snowflake / BigQuery / Postgres | 5 | read-only | ☐ |
| Slack | 5 | bot + send | ☐ |
| SEC EDGAR | 1 | read-only | ☐ |
| NewsAPI + Bing News | 1 | read-only | ☐ |
| Google Patents (BigQuery) | 1 | read-only | ☐ |
| FRED | 1 | read-only | ☐ |
| Tavily / Brave (web search) | 0/1 | read-only | ☐ |
| Asana / GitHub Projects / Monday | deferred | — | 🧊 |

---

## Tool Catalog (registered with MCP gateway)

| Tool | Phase | Owner agent | Status |
|---|---|---|---|
| `web_search` | 0 | research mesh | ☐ |
| `web_fetch` | 0 | research mesh | ☐ |
| `edgar_filings` | 0/1 | market_researcher, competitor_analyst | ☐ |
| `lookup_memory` | 0 | all agents | ☐ |
| `code_interpreter` | 2 | mcda_evaluator, option_generator | ☐ |
| `news_recent` | 1 | research mesh | ☐ |
| `patents_lookup` | 1 | tech_scout, competitor_analyst | ☐ |
| `macro_fred` | 1 | macro_analyst | ☐ |
| `lookup_company` | 2 | all agents | ☐ |
| `lookup_competitor` | 2 | competitor_analyst | ☐ |
| `lookup_segment` | 2 | customer_researcher | ☐ |
| `lookup_capability` | 2 | staffing recommender | ☐ |
| `lookup_synergy_candidate` | 7 | portfolio agents | ☐ |
| `capture_hypothesis` / `capture_option` / `capture_assumption` / `capture_risk` / `capture_open_question` | 4 | brainstorm voice session | ☐ |

---

## Recent Changes (most recent first — append-only)

> Format: `### YYYY-MM-DD · <one-line summary>` then a few bullet points of what changed and where.

### 2026-05-20 · Memory & Learning robustness review applied
- [MEMORY_AND_LEARNING_REVIEW.md](./MEMORY_AND_LEARNING_REVIEW.md) **new** — 50+ edge cases enumerated; 14 critical gaps; 12 high-ROI techniques adopted from external work (Mem0, Letta, Graphiti, A-MEM, HippoRAG, Voyager, Generative Agents, DSPy, Constitutional AI); 9 anti-patterns formalized
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) v4 — schema upgrades in Phase 0 (bi-temporal, embedding-version, claim_modality, derivation_depth, Decision table, source_trust_register), Phase 1 unified extraction + canonical normalization + Bayesian confidence + quarantine + reflection cron, Phase 1 retrieval upgraded to RRF + cross-encoder rerank + MMR + bi-temporal clamp, Phase 2 multi-hop HippoRAG PPR added (renumbering Share-and-Apply to 2.8), Phase 6 calibration upgraded with proper scoring rules + intervention cohorts + Bayesian priors, Phase 6 Voyager-style playbook engine, Phase 6 Constitutional audit, new Phase 6.6 causal attribution with industry DAGs
- [CLAUDE.md](./CLAUDE.md) v2 — Critical Patterns C19-C25 added (bi-temporal, canonical-form, Bayesian-over-sources, embedding-version, ADD/UPDATE/SUPERSEDE/NOOP unified decision, quarantine tier, proper scoring rules)

### 2026-05-20 · Share-and-Apply feature integrated; principles updated
- [GUIDING_PRINCIPLES.md](./GUIDING_PRINCIPLES.md) v2: added H13 (External strategies as first-class inputs) and H14 (UX is calm by default — cross-reference to [UX_DESIGN.md](./UX_DESIGN.md))
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) v3: Share-and-Apply workstreams across Phases 1 (artifact recognition), 2 (fit + adapt + memo), 3 (micro war-game deep mode), 4 (voice triggers), 7 (cross-portco applied library)
- [DEFERRED_BACKLOG.md](./DEFERRED_BACKLOG.md): added E3a (browser extension right-click → "Apply this to portfolio")
- Feature Status matrix: Share-and-Apply added (Phase 2)

### 2026-05-20 · Initial planning artifacts committed
- Created `docs/strategy-platform/` folder with 6 living docs
- [GUIDING_PRINCIPLES.md](./GUIDING_PRINCIPLES.md): 8 non-negotiables (P1-P8), 12 heuristics (H1-H12), 7 explicit non-builds
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md): Phase 0-8 detailed with acceptance gates, ran through 3 review passes, applied 24 fixes (v2)
- [DEFERRED_BACKLOG.md](./DEFERRED_BACKLOG.md): 13 sections (A-M) of deferred items with promotion criteria + locked Won't-Build list
- [UX_DESIGN.md](./UX_DESIGN.md): 12 design principles (DP1-DP12), 21-source reference set, 13 surfaces, design system, signature elements
- [CLAUDE.md](./CLAUDE.md): 18 Critical Patterns (C1-C18), Known Bug Patterns catalog, ultra-review protocol, subsystem map — patterns imported from Meridian's CLAUDE.md
- This MASTER.md: source-of-truth index, status legend, feature matrix, change log

---

## Open Decisions (pending — required before Phase 0 starts)

Mirror of the table in [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md). Resolutions land here as inline edits.

| # | Question | Status | Resolution |
|---|---|---|---|
| OD1 | Cloud: AWS or GCP? | 🟡 pending | — |
| OD2 | Postgres + Neo4j, or Postgres-only with pgvector + graph tables? | 🟡 pending | — |
| OD3 | Auth: Google Workspace OIDC, Auth0, or WorkOS? | 🟡 pending | — |
| OD3a | Secrets vault | 🟡 pending | — |
| OD4 | LLM router: LiteLLM or custom? | 🟡 pending | — |
| OD5 | Realtime voice: OpenAI Realtime + Gemini Live? | 🟡 pending | — |
| OD6 | Long-form transcription vendor | 🟡 pending | — |
| OD7 | Vision model default | 🟡 pending | — |
| OD8 | Embedding stack | 🟡 pending | — |
| OD9 | Image gen for diagrams | 🟡 pending | — |
| OD10 | On-prem model family | 🟡 pending | — |
| OD11 | Code interpreter sandbox | 🟡 pending | — |
| OD12 | Cost SLO numeric target | 🟡 pending | — |
| OD12a | On-prem GPU sizing | 🟡 pending | — |

---

## Calibration Scorecard (placeholder — populated from Phase 6)

| Metric | Latest | Trend | Target |
|---|---|---|---|
| Closed predictions | 0 | — | ≥ 20 by Phase 6 gate |
| Framework hit rate | — | — | track per framework |
| Model accuracy delta | — | — | per (model × task) |
| Persona prediction accuracy | — | — | per persona class |
| Memory audit stale-claim catches/wk | — | — | ≥ 1 |

---

## Portfolio Roster (placeholder — populated as portcos onboard)

| Portco | Status | Industry | Phase 7 prereq | Notes |
|---|---|---|---|---|
| (none yet) | — | — | — | — |

Phase 7 gate requires ≥ 3 portcos with ≥ 1 active project each.

---

## How to Update This Doc

(The protocol that keeps this from becoming Meridian's stale `MERIDIAN_CURRENT_STATE.md`.)

**When to update — required:**
1. A workstream from [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) ships → update Phase Status table + relevant Feature Status row + add an entry to Recent Changes.
2. A new connector goes live → update Connector Inventory.
3. A new tool registered in MCP → update Tool Catalog.
4. An Open Decision is resolved → update OD row inline + add to Recent Changes.
5. A portco is onboarded → update Portfolio Roster + check Phase 7 prereq.
6. Header `Generated / Last Major Update` and `Last commit at update time` change with every PR that touches this file.

**When to update — encouraged but not required:**
- Calibration scorecard refreshed weekly from Phase 6 onward.
- Recent Changes pruned: keep last 30 entries inline; archive older to `MASTER_history.md`.

**Bug**: this doc more than 14 days stale at the time of a major shipping change. File a fix-doc PR.

---

## Document History

- **v1 · 2026-05-20** — Initial MASTER.md. Sections: Header metadata · Status legend · Index of docs · Phase status · Feature status matrix (~45 capabilities tracked) · Connector inventory · Tool catalog · Recent changes (append-only) · Open decisions · Calibration scorecard placeholder · Portfolio roster placeholder · How-to-update protocol. Designed to avoid the Meridian failure mode of multiple competing stale master docs.

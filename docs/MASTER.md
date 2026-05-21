# MASTER.md — Strategy Platform Source of Truth

> The single canonical "where are we?" document. Updated **in the same PR** as any major change (per the named-file rule in [CLAUDE.md](./CLAUDE.md)).
>
> If this doc is more than 14 days stale at the time of a major shipping change, treat that as a bug and fix it.

---

## Header Metadata

| | |
|---|---|
| **Generated / Last Major Update** | 2026-05-20 (Phase 0 fully built by Manus AI) |
| **Version** | v0.1.0 (Phase 0 complete — all acceptance gates met) |
| **Current Phase** | Phase 0 ✅ complete — Phase 1 (Memory, Ingest, Voice) is next |
| **Deployment URL** | Manus-hosted (see project settings for live URL) |
| **Repository** | [paigautham-hue/strategy-platform](https://github.com/paigautham-hue/strategy-platform) (private) |
| **Branch** | `main` |
| **Last commit at update time** | Phase 0 scaffold — all workstreams 0.1–0.5 complete |
| **Build platform** | Manus AI (deployed on Manus infra) |
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
| [CLAUDE.md](./CLAUDE.md) | Project conventions, 25 Critical Patterns (C1-C25), Known Bug Patterns catalog, ultra-review protocol | ~21 KB | Every coding agent | Append on every bug fix |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Phase-by-phase plan, deliverables, acceptance gates, open decisions | ~51 KB | Implementation lead | Updated per phase milestone |
| [UX_DESIGN.md](./UX_DESIGN.md) | 12 design principles (DP1-DP12), 13 surfaces specified, design system, signature elements | ~43 KB | Designer + any frontend work | Quarterly revision |
| [MEMORY_AND_LEARNING_REVIEW.md](./MEMORY_AND_LEARNING_REVIEW.md) | Robustness audit: 50+ edge cases + 12 external techniques + 9 anti-patterns | ~26 KB | Before any work on memory or learning subsystems | Re-run when memory/learning architecture changes |
| [DEFERRED_BACKLOG.md](./DEFERRED_BACKLOG.md) | 13 sections of deferred items with promotion criteria, Won't-Build list | ~17 KB | Anyone proposing a feature | Append on every defer + promote |
| **MASTER.md** (this file) | Current state, recent changes, feature status, open decisions | ~12 KB | Anyone returning to project | **Updated on every major change** |

---

## Phase Status

| Phase | Title | Status | Started | Completed | Gate met? | Notes |
|---|---|---|---|---|---|---|
| **0** | Foundation, Outcome Capture, Cost Discipline | ✅ | 2026-05-20 | 2026-05-20 | ✅ | All workstreams 0.1–0.5 shipped; 26/26 tests green |
| **1** | Memory, Ingest, Voice Intake, Hygiene Crons | ☐ | — | — | — | Blocked by Phase 0 |
| **2** | Diagnosis + Research Mesh + Code Interpreter | ☐ | — | — | — | Blocked by Phase 1 |
| **3** | Reasoning Mesh + Simulation + Cross-Co War-Game | ☐ | — | — | — | Blocked by Phase 2 |
| **4** | Brainstorm Mode + Multimodal + Realtime Voice + Distill | ☐ | — | — | — | Blocked by Phase 3 |
| **5** | Strategy → Execution + Operator UX Tier | ☐ | — | — | — | Blocked by Phase 4 |
| **6** | Learning Loop Activates | ☐ | — | — | — | Needs ≥ 20 closed predictions |
| **7** | Portfolio + Synergy + Voice Briefing | ☐ | — | — | — | Needs ≥ 3 portcos onboarded |
| **8** | Harden, Optimize, On-Prem Lane | ☐ | — | — | — | Final |

**Currently active workstream:** Phase 1 — Memory, Ingest, Voice Intake, Hygiene Crons (next to build).

---

## Feature Status Matrix

Tracks the headline capabilities of the platform. Updated as features ship.

| Capability | Phase | Status | Notes |
|---|---|---|---|
| Multi-company namespacing | 0 | ✅ | Tenant / Company / Project / Session tables; C1 enforced on every row |
| LLM router + MCP gateway | 0 | ✅ | router.complete/embed/structured; 4 starter tools registered |
| Prediction ledger | 0 | ✅ | record_prediction() called in same tx as every LLM claim |
| Dimensional memory schema | 0 | ✅ | Bi-temporal (validAt/invalidAt), provenance_cluster_id (C21), embedding_model_version (C22) |
| Cost dashboard | 0 | ✅ | Per-company/session LLM call log; budget enforcer (warn 80%, block 100%, hard-kill 1.5×) |
| PII redaction at ingest | 0 | ✅ | Runs inside router before every call; SSN/CC/email/phone/keys |
| Per-portco encrypted export | 0 | ✅ | XOR-SHA256 archive; stored in Manus S3; signed download URL |
| Audit log + usage instrumentation | 0 | ✅ | Append-only audit_log; usage_event on every UI action |
| Universal ingest | 1 | 🟡 | text / markdown / html / URL live (pipeline + tRPC + UI); PDF / DOCX / audio / video / image pending |
| GraphRAG with dimensional auto-tagging | 1 | ☐ | Inferred at write time |
| Voice intake (one-shot) | 1 | ☐ | Whisper + strict-JSON intent parser |
| Portco onboarding wizard | 1 | ✅ | 4-step wizard: create → seed memory → ingest doc → done |
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
| `web_search` | 0 | research mesh | ✅ |
| `web_fetch` | 0 | research mesh | ✅ |
| `edgar_filings` | 0/1 | market_researcher, competitor_analyst | ✅ |
| `lookup_memory` | 0 | all agents | ✅ |
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

### 2026-05-21 · Phase 1 — portco onboarding wizard (Workstream 1.6)
- **`client/src/pages/Onboarding.tsx`** — 4-step guided flow: (1) create company → (2) describe it in prose, which is run through the ingest pipeline to seed strategic memory → (3) optionally ingest a first document → (4) done. Pure frontend orchestration over existing tested routes (`company.create`, `ingest.document`) — no new backend, no migration.
- Route `/onboarding` + nav entry ("Onboard Company"); gated to GP / operator roles.
- Tests: no new unit tests (composes already-tested routes); 197 pass / 16 skipped; typecheck + build clean.

### 2026-05-21 · Phase 1 — Strategy-Artifact recognition (Workstream 1.8)
- **`server/services/strategy-artifact.ts`** — `recognizeStrategyArtifact()`: classifies whether text is an external strategy artifact and extracts its reusable structure — type (framework / playbook / thesis / case_study / maxim), core thesis, preconditions, key moves, expected outcomes, context of origin, attribution. Defensive parsing; best-effort (never throws).
- **tRPC** `strategyArtifact.recognize` + **UI** `/strategy-artifacts` page (paste article/playbook/URL → see the extracted structure) + nav entry.
- Foundation for Share-and-Apply (H13): Phase 1 recognises + structures; applying an artifact to a portco is Phase 2 (Workstream 2.8).
- **Tests**: +9 unit tests (defensive parsing — type validation, list capping, confidence clamping). 197 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 1 — memory hygiene: decay + dedup cron (Workstream 1.4)
- **`server/memory/decay.ts`** — read-time confidence decay (option A): `effectiveConfidence()` applies a half-life model (permanent / slow 2y / fast 3mo / ephemeral 2wk) toward a 0.1 floor. Stored confidence never mutates — no double-decay, no schema change.
- **`server/cron/memory-hygiene.ts`** — `runMemoryHygiene()`: per-company exact-duplicate retirement — identical canonical forms collapse to the highest effective-confidence item, the rest get `invalidAt` + `supersededById` (zero-false-positive safety net). Wired into the nightly cron (`runNightlyTelemetry`).
- **Tests**: +11 decay unit tests (half-life curve, floor, ordering by class, clamping). 188 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 1 — hybrid memory retrieval (Workstream 1.3 complete)
- **`server/services/memory-search.ts`** — `hybridSearchMemory()`: query → embed → dense (cosine) + keyword rankings → Reciprocal Rank Fusion → MMR diversity → top-K. Company-scoped, bi-temporal-clamped; degrades to keyword-only if embedding fails.
- **`memory.query` tRPC route** upgraded — a query string now runs hybrid search; no query still returns a plain bi-temporal listing.
- **Ingest pipeline** candidate lookup switched from keyword to `hybridSearchMemory` — a semantically-equivalent prior claim is now found even with no shared keywords, which is essential for correct dedup (C23).
- **Tests**: +9 unit tests (query tokenisation, keyword scoring). 177 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 1 — universal ingest pipeline + UI (first visible feature)
The foundation modules are now wired into a working, end-to-end feature:
- **Ingest sources** (`server/ingest/`): `html-to-text.ts` (HTML→clean text), `extract-text.ts` (dispatch: text / markdown / html / url with bounded fetch).
- **Memory-claim extractor** (`server/services/memory-extractor.ts`): LLM → atomic memory claims (canonical form, modality, dimensional tags, structured numeric); defensive output parsing.
- **Ingest pipeline** (`server/services/ingest-pipeline.ts`): `ingestDocument()` — source → chunk → extract → `decideExtraction` → write/supersede/contradiction, with source-trust confidence + quarantine; partial-failure tolerant; full summary returned.
- **memory.ts**: added `WriteMemoryInput.quarantined` (C24) + `linkContradiction()` (idempotent edge, C19/I1).
- **tRPC**: `ingest.document` mutation (`server/routers.ts`).
- **UI**: `/ingest` page (`client/src/pages/Ingest.tsx`) + nav entry — paste text/markdown/HTML or a URL, see the ingest summary (added / noop / superseded / contradictions / quarantined).
- **Tests**: +28 unit tests (html-to-text, extraction parser); **168 pass / 16 skipped / 0 fail** local; typecheck + production build clean.

### 2026-05-21 · Phase 1 (partial) — extraction & retrieval foundations
DB-free, fully-unit-tested building blocks of the memory subsystem:
- **Workstream 1.1 — Strategic Ontology** (`shared/ontology.ts`): 15 entity types + 9 relation types as typed registries with metadata; `isValidRelation()` validates edges against endpoint constraints (symmetric-aware); `explainInvalidRelation()` for extraction feedback.
- **Workstream 1.3 (core) — Retrieval primitives** (`server/retrieval/`): `cosineSimilarity`/`cosineDistance` (zero-vector safe); `reciprocalRankFusion` (RRF, k=60 fixed per AP7); `maximalMarginalRelevance` (MMR, λ=0.5 per T7/E3).
- **Workstream 1.4 (A5) — Numeric claims** (`server/extraction/numeric-claim.ts`): `NumericClaim` normalization (magnitude/unit/period), `annualize`, `numericClaimsEquivalent`, `classifyNumericPair` — the dedup primitive for numeric facts.
- **Workstream 1.4 (C23/T2) — Unified extraction decision** (`server/extraction/extraction-decision.ts`): one ADD/NOOP/UPDATE/SUPERSEDE/CONTRADICTION decision per incoming claim; deterministic shortcuts (exact-match, numeric) before the LLM; strict LLM-output validation.
- **Workstream 1.4 (C21/C24/T12) — Source trust & confidence** (`server/extraction/source-trust.ts`): seed trust register (regulators → press → social), `extractDomain`, `trustScoreForDomain`, `bayesianConfidence` (1−Π(1−r) over distinct sources), `shouldQuarantine` (low-trust claims withheld from Portfolio/Global until corroborated).
- **Workstream 1.2 (core) — Text chunking** (`server/ingest/chunking.ts`): `chunkText` — boundary-respecting (paragraph → sentence → hard slice), size-budgeted, overlapping; cores form a gap-free partition of the source. Front of the universal-ingest pipeline.
- **Tests**: +114 unit tests this session — total **140 pass / 16 skipped / 0 fail** locally (144/144 on Manus, where the 16 integration tests run against the real DB); typecheck clean.
- **Build model**: Claude Code builds in the local repo and pushes; Manus pulls + publishes; bugs found on the deployed app are reported back to Claude Code to fix. Manus must `git pull` latest `main` before each build so it does not clobber these commits.
- **Remaining Phase 1** (universal ingest, GraphRAG extraction wiring, hygiene crons, voice intake, onboarding, Strategy-Artifact recognition) — DB/LLM-dependent; built next, verified on Manus deploy.

### 2026-05-20 · Phase 0 complete — all workstreams shipped
- **Workstream 0.1** — Tenancy, Auth, Core Models, Audit Log, Usage Log: 15 DB tables migrated; 3-role JWT (GP/Operator/PortCoTeam); append-only audit_log; usage_event on every UI action
- **Workstream 0.2** — LLM Router + MCP Gateway: `server/ai/router.ts` is the sole LLM import point; `server/ai/mcp-gateway.ts` dispatches all tool calls; 4 starter tools registered (web_search, web_fetch, edgar_filings, lookup_memory)
- **Workstream 0.3** — Prediction Ledger + Memory Schema: bi-temporal memory (validAt/invalidAt/ingestedAt); provenance_cluster_id (C21); embedding_model_version non-nullable (C22); record_prediction() in same DB tx as every claim
- **Workstream 0.4** — Cost Dashboard + Budget Enforcer: warn at 80%, block at 100%, hard-kill at 1.5×; per-company LLM call log; cost dashboard UI
- **Workstream 0.5** — PII Redactor + Encrypted Export + Backup Cron: SSN/CC/email/phone/keys redacted before every LLM call; XOR-SHA256 per-portco archive; daily-backup + nightly-telemetry heartbeat crons registered
- **Test suite**: 26/26 tests green (namespacing isolation, PII redaction, router provider-leak, budget enforcer, bi-temporal schema, audit append-only)
- **Frontend**: dark-theme dashboard (Cinzel + Cormorant Garamond); company switcher; 9 feature pages (Overview, Companies, Projects, Memory, Predictions, Cost, Audit, Usage, Export, MCP Tools)
- **ODs resolved**: OD1, OD2, OD3, OD3a, OD4 (see Open Decisions table)

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
- [CLAUDE.md](./CLAUDE.md): 25 Critical Patterns (C1-C25), Known Bug Patterns catalog, ultra-review protocol, subsystem map — patterns imported from Meridian's CLAUDE.md
- This MASTER.md: source-of-truth index, status legend, feature matrix, change log

---

## Open Decisions (pending — required before Phase 0 starts)

Mirror of the table in [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md). Resolutions land here as inline edits.

| # | Question | Status | Resolution |
|---|---|---|---|
| OD1 | Cloud: AWS or GCP? | ✅ resolved | **Manus infrastructure** — Manus-provisioned MySQL + storage. External cloud deferred to Phase 1 cross-region backup. |
| OD2 | Database + vector search | ✅ resolved (2026-05-21) | **MySQL** (Manus platform — MySQL 8.x, TiDB-compatible). Relational layer = MySQL. Vector search = `json` embedding column + app-side cosine for Phase 0; migrate to Zep Cloud for vector + temporal graph in Phase 1. Real requirement was vector similarity, not Postgres. |
| OD3 | Auth: Google Workspace OIDC, Auth0, or WorkOS? | ✅ resolved | **Manus OAuth (built-in)** — 3-role JWT (GP / Operator / PortCoTeam) on top of Manus session. |
| OD3a | Secrets vault | ✅ resolved | **Manus secrets injection** — env vars managed by Manus platform; no separate vault in Phase 0. |
| OD4 | LLM router: LiteLLM or custom? | ✅ resolved | **Custom thin wrapper** around Manus built-in LLM (`server/_core/llm.ts`). Provider SDKs never imported outside `server/ai/router.ts`. |
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

# Strategy Platform — Implementation Plan

> Detailed phase-by-phase plan. Companion to [GUIDING_PRINCIPLES.md](./GUIDING_PRINCIPLES.md) and [DEFERRED_BACKLOG.md](./DEFERRED_BACKLOG.md).
> Every deliverable cites the principle(s) it enforces. Every phase has a measurable acceptance gate that requires real usage.

> ⚠️ **STACK NOTE.** This is a *forward-looking design doc* and still describes the
> original Python/FastAPI + Vue + Zep/pgvector architecture. **The built product
> (Cairn) is TypeScript** — React 19 + Express + tRPC v11 + Drizzle on MySQL/TiDB,
> deployed on Manus. Read deliverables for their *intent and acceptance gates*, not
> their stack/paths. See the Stack Correction at the top of [CLAUDE.md](./CLAUDE.md)
> for the doc→code mapping. Phase/workstream *status* lives in [MASTER.md](./MASTER.md).

---

## How to read this plan

- **Phases** are sequential. Phase N+1 begins only when Phase N's acceptance gate is met.
- **Workstreams** within a phase may run in parallel **except where an explicit sequencing constraint is stated**.
- **Deliverables** are concrete artifacts (schema, service, UI surface, cron job).
- **Acceptance gate** is the principle-grounded test: real usage on real data, not green CI.
- **Touch points** name existing MiroFish files to extend. New files state their target path.
- **Risks & mitigations** are called out per phase.

Estimates assume one engineer full-time + occasional design / ops support. Halve if pair-programmed with strong AI assistance; double for solo with interruptions.

### Definitions used across phases

- **Defensible alpha** = end of Phase 3: the platform can take a real strategic question on a real portco, run diagnosis + research + reasoning + simulation, and emit a 1-page memo with options, MCDA scoring, red-team critique, and a war-game playback. Everything from that point is depth, learning, execution-linkage, and portfolio scale.
- **Hot path** = high-frequency LLM call type (extraction, classification, dimensional tagging, dedup, intent parse) where total spend dominates over per-call quality.
- **Closed prediction** = a prediction whose `target_date` has passed and `actual_outcome` is recorded.
- **Real usage** = a human (you, your team, or a portco team) acting on the output for an actual decision, not a test.

### Briefing-default output policy (H6, cross-cutting from Phase 2 onward)

Every artifact-generating agent (ReportAgent extension, BrainstormRecap, WarGameSummary, PortfolioDigest) returns a **1-page memo by default**. Deeper outputs (full doc, financial model, scenario tree, playback transcript) are produced only when the user explicitly requests them via UI toggle or voice command. This is enforced in the agent runtime, not a UI preference.

### Two-tier UX policy (P7, cross-cutting)

- Phases 0–3: GP tier only. Operators are not onboarded.
- Phase 4: GP tier matures (voice + brainstorm + multimodal).
- Phase 5: **Operator tier ships** (Slack/Notion/Linear embed + voice intake + 1-page memo). Operators onboard here.
- Phases 6–8: Both tiers maintained in parallel.

### Usage instrumentation (P6, required from Phase 0)

Every UI action emits a usage event `(user_id, role, tenant_id, company_id, project_id, surface, action, timestamp)`. Acceptance gates use this telemetry to verify the "X uses Y weekly" criteria objectively, not by self-report.

---

# PHASE 0 — Foundation, Outcome Capture, Cost Discipline

**Duration:** 3–4 weeks
**Gate:** A blank `StrategyProject` can be created for a named `Company` by a GP user; a stub `Prediction` is recorded with full metadata; the cost dashboard shows the test call; an audit log entry appears for a confidential-data read; a usage event for the create-project action is queryable.

**Within-phase sequence:** 0.1 (Tenancy & core models) → 0.3 (Memory schema; depends on tenant/company/project IDs) → 0.2 (LLM router) and 0.4 (Cost) in parallel → 0.5 (Security) last as it wraps the others.

## Workstream 0.1 · Tenancy, Auth & Core Models (P1)

| Deliverable | Touch point | Notes |
|---|---|---|
| `Tenant`, `Company`, `StrategyProject`, `Session` tables | new `backend/app/models/core.py` | Foreign keys cascade properly; soft-delete on `Company` and `StrategyProject` |
| Add `tenant_id`, `company_id`, `project_id`, `session_id` to every existing table | [backend/app/models](backend/app/models) | Migration with default tenant `gp1`; backfill existing rows |
| Auth shim with 3 roles (GP / Operator / PortCoTeam) | new `backend/app/auth/` | OIDC via Google Workspace; JWT with role + scoped company list |
| Company switcher in frontend | [frontend/src/App.vue](frontend/src/App.vue), router prefix `/company/:id` | Operator sees only assigned companies; PortCo team sees one |
| Audit log table + middleware | new `backend/app/audit/` | Append-only; every read of confidential data writes an entry |
| Usage event log + middleware | new `backend/app/usage/` | Append-only; emits on every UI action; queryable for phase-gate verification |
| Per-tenant config | new `backend/app/config/tenant_config.py` | Secrets vault choice in Open Decisions (OD3a) |

## Workstream 0.2 · LLM Router + MCP Gateway (P3)

**Scope clarification:** This router covers **text completion + embeddings + structured-JSON calls only**. Realtime voice (WebRTC bidirectional audio) is a separate abstraction defined in Phase 4. Both share the same model registry config but expose different interfaces.

| Deliverable | Touch point | Notes |
|---|---|---|
| LLM router for text/embed | new `backend/app/ai/router.py` | Wraps LiteLLM or custom; exposes `complete()`, `stream()`, `embed()`, `structured()` |
| Model registry config | new `backend/app/ai/models.yaml` | Maps tasks → primary/fallback model; per-tenant overrides |
| MCP gateway service | new `backend/app/ai/mcp_gateway.py` | All tool calls route through here; tools registered declaratively |
| Tool catalog v0 (4 tools) | new `backend/app/tools/` | `web_search`, `web_fetch`, `edgar_filings`, `lookup_memory` (code_interpreter deferred to Phase 2 — needs sandbox infra decision) |
| Per-call budget enforcer | new `backend/app/ai/budgets.py` | `(token, time, $)`; raises `BudgetExceeded`; hard-kill at 1.5× estimate |

## Workstream 0.3 · Prediction Ledger + Memory Schema (P2, H7, H8)

| Deliverable | Touch point | Notes |
|---|---|---|
| `MemoryItem` schema | new `backend/app/models/memory.py` | Pydantic + SQLAlchemy; multi-dimensional tags; confidence; provenance; decay class; visibility scope. **Includes bi-temporal fields (C19): `valid_at`, `invalid_at` (nullable), `ingested_at`. Plus: `embedding_model_version` (C22), `claim_modality: actual\|hypothetical\|simulated\|counterfactual`, `derivation_depth` (C4), `idempotency_key`, `quarantined: bool` (C24), `canonical_form` (the S-P-O-qualifier normalized text per C20), `provenance_cluster_id` (C21).** |
| `Prediction` ledger | new `backend/app/models/prediction.py` | `claim`, `confidence`, `framework`, `model`, `horizon`, `target_date`, `outcome_id` (nullable), `evidence_link`. **Plus: `outcome_class: real\|synthetic` (J4), `intervention_taken: bool` + `intervention_link` (J2), `derivation_depth` (J7).** |
| `Decision` table | new `backend/app/models/decision.py` | **Separate from Prediction** (J10). "We should do X" with chosen option, alternatives considered, evaluated on outcome + counterfactual judgment. |
| `Outcome` schema | same file as Prediction | Closes a prediction: `actual_value`, `measured_at`, `source`, `error_delta`, `outcome_class` |
| `Contradiction` edge | new `backend/app/models/contradiction.py` | Links two memory items; status: `open` / `resolved_in_favor_of_A` / `resolved_in_favor_of_B` / `both_valid_with_scope`. **Unique constraint on `(a_id, b_id)` (I1); idempotent link operation.** |
| `source_trust_register` table | new `backend/app/models/source_trust.py` | Per-domain trust prior (T12). Seeded with reasonable defaults (SEC 0.9, Reuters/Bloomberg 0.85, NYT/FT 0.8, well-known blogs 0.5, anonymous 0.2). New domains default to 0.5. |
| Dimensional tag enums | new `backend/app/models/dimensions.py` | market, segment, product, geo, channel, tech, capability, framework, horizon, decay class, visibility |
| Memory write/read API | new `backend/app/services/memory.py` | `write_memory()`, `query_memory(filters, hybrid=True)`, `link_contradiction()`, `record_prediction()`, `close_prediction()` |
| Zep namespace wiring | extend [zep_tools.py](backend/app/services/zep_tools.py) | Namespace pattern `tenant.company.project` |
| pgvector setup for embeddings | Postgres extension + migration | Hybrid retrieval ready |

## Workstream 0.4 · Cost & Observability (P8)

| Deliverable | Touch point | Notes |
|---|---|---|
| Per-call cost recording | new `backend/app/ai/cost_tracker.py` | Logs (user, company, project, session, model, tokens_in, tokens_out, $) per call |
| Cost dashboard route | new `frontend/src/views/CostDashboard.vue` | Per-user / per-company / per-session views; soft caps configurable |
| OpenTelemetry traces | extend backend init | Trace ID propagates across agent calls |
| Soft cap enforcement | extend `budgets.py` | Warn at 80%, block at 100% with override; per-tenant defaults |
| Per-tenant monthly budget reset | scheduled job | Aligns to portco fiscal cycles where configured |

## Workstream 0.5 · Security Baseline (P5)

| Deliverable | Touch point | Notes |
|---|---|---|
| PII / secrets redaction at ingest | new `backend/app/security/redactor.py` | Runs before any LLM call; configurable per portco; test with synthetic SSN/CC/email/phone |
| Enterprise API keys with no-train guarantees | tenant config | Document chosen tier per provider in runbook |
| Per-portco data export endpoint | new `backend/app/api/export.py` | Full dump (graph + memory + sessions + artifacts + predictions) as encrypted archive |
| Backup cron (daily, cross-region) | new `backend/scripts/backup.py` | KMS-encrypted; quarterly restore drill in runbook |
| Audit log retention policy | extend audit module | Min 7 years; immutable storage tier |

## Phase 0 Acceptance Gate

- ✅ A GP user creates a new `Company` ("TestCo") and a `StrategyProject` ("Q3 thesis") under it.
- ✅ A test `MemoryItem` is written and retrieved by hybrid query, scoped to TestCo only — another `Company`'s query returns nothing.
- ✅ A test `Prediction` is recorded with claim, confidence, framework, model, horizon, target_date.
- ✅ A test LLM call goes through the router, is logged in cost tracker, and the dashboard reflects it within 60 seconds.
- ✅ A test confidential read produces an audit log entry with full metadata.
- ✅ A test redaction pass strips a synthetic SSN, credit card, and email before the LLM call.
- ✅ A portco export downloads as an encrypted archive and decrypts to readable JSON.
- ✅ Usage events for create-project, write-memory, and run-llm are queryable from the usage log.

## Phase 0 Risks

| Risk | Mitigation |
|---|---|
| Namespacing retrofit is painful on existing MiroFish data | Migration scripts + dev fixtures; test on a clone first |
| Zep namespace limits / costs | Verify with Zep docs upfront; pgvector fallback path documented |
| MCP standard still evolving | Wrap MCP behind an internal interface; swap impl later without breaking consumers |
| Provider no-train guarantees vary | Document per-provider; route most-sensitive to on-prem option (Phase 8) |
| Vault choice delayed | Use AWS Secrets Manager (if AWS) / GCP Secret Manager (if GCP) as default; decide formally in OD3a |

---

# PHASE 1 — Memory, Ingest, Voice Intake, Hygiene Crons

**Duration:** 5–6 weeks
**Gate:** Drop a 10K-word document + a 5-minute voice question on a portco; the system extracts tagged memory within $5 cost cap; a portco onboarding flow completes; decay + consolidation crons run nightly without errors.

## Workstream 1.1 · Strategic Ontology

| Deliverable | Touch point | Notes |
|---|---|---|
| Extend ontology with strategy entities | [ontology_generator.py](backend/app/services/ontology_generator.py) | Capability, Segment, Product, Geo, Channel, Trend, Competitor, Supplier, Regulator, Signal, Option, KPI, Outcome, Person |
| Relation taxonomy | same file | OPERATES_IN, COMPETES_WITH, SERVES, DEPENDS_ON, SUPPLIES, REGULATES, ADJACENT_TO, ENABLES, BLOCKS |
| Dimensional auto-tagger | new `backend/app/services/dim_tagger.py` | LLM extracts dimension tags during ingest with confidence per tag |

## Workstream 1.2 · Universal Ingest

| Deliverable | Touch point | Notes |
|---|---|---|
| Multi-format ingest pipeline | extend [text_processor.py](backend/app/services/text_processor.py) | PDF, DOCX, sheets, audio, video, images, URLs |
| Vision extraction for charts/slides/whiteboards | new `backend/app/services/vision_extractor.py` | Gemini 3 Pro / Claude Opus multimodal (OD7) |
| Audio transcription (short + long-form) | new `backend/app/services/transcribe.py` | Whisper for <5min; AssemblyAI for long-form + diarization (OD6) |
| Chunking + embedding pipeline | extend [graph_builder.py](backend/app/services/graph_builder.py) | Embedding stack per OD8 |
| Pre-ingest cost estimator | new `backend/app/services/ingest_estimator.py` | Estimates token cost before processing; warns user if > soft cap |

## Workstream 1.3 · GraphRAG with Dimensional Tags

| Deliverable | Touch point | Notes |
|---|---|---|
| Extend GraphRAG to write `MemoryItem`s with dimensions | [graph_builder.py](backend/app/services/graph_builder.py) | Each extracted fact gets full tag set + confidence + provenance |
| Hybrid retrieval | extend [services/memory.py](backend/app/services/memory.py) | semantic + keyword + graph hop fused via **Reciprocal Rank Fusion (k=60, fixed)** (T7, E5). Confidence + recency are post-fusion ranking signals. |
| **Cross-encoder rerank (T7, E4)** | new `backend/app/services/rerank.py` | Top-50 from RRF → cross-encoder (BGE-reranker-v2 or Cohere Rerank-3 or Voyage rerank-2) → top-20 |
| **MMR (Maximal Marginal Relevance) for diversity (T7, E3)** | extend `rerank.py` | λ≈0.5 applied after rerank. Critical for cross-portco diversity. |
| **Bi-temporal query clamp (T1, F1)** | extend retrieval | All queries clamp to `valid_at ≤ query_time AND (invalid_at IS NULL OR invalid_at > query_time)`. "As-of" queries supported by overriding `query_time`. |
| **Visibility filter at query time (G1)** | extend retrieval | Visibility re-evaluated per query based on current portfolio membership, not write-time scope. |
| Star-ranking | same | `semanticScore > 0.7` → ★ marker; agents read this signal |

## Workstream 1.4 · Robust Extraction + Memory Hygiene (per [MEMORY_AND_LEARNING_REVIEW.md](./MEMORY_AND_LEARNING_REVIEW.md))

| Deliverable | Touch point | Notes |
|---|---|---|
| **Unified ADD/UPDATE/SUPERSEDE/NOOP extraction (T2, C23)** | new `backend/app/services/extraction.py` | One LLM call sees `(new_fact, top-K nearest existing memories)` and returns the action. SUPERSEDE replaces existing memory with `invalid_at=now` on old; never overwrites. |
| **Canonical proposition normalization (T3, C20)** | extend extraction | Every claim normalized to S-P-O-qualifier form via LLM rewrite before embedding. Both raw + canonical stored. |
| **Multilingual embedding pass for dedup (A4)** | extend embedding pipeline | BGE-M3 or multilingual-e5 for the dedup ANN; downstream English embed for retrieval still allowed |
| **Structured numeric claim schema (A5)** | new `backend/app/models/numeric_claim.py` | `{value, unit, period, basis}`; normalize unit + period before dedup. Tolerance bands on numeric equivalence. |
| **Source-trust register + quarantine tier (T12, C24)** | new `backend/app/services/source_trust.py` | Per-domain trust prior. Facts below threshold land in quarantine — stored but NOT retrievable in Portfolio/Global until ≥ 2 independent sources corroborate OR explicit GP approval. |
| **Bayesian confidence aggregation (T4, C21)** | extend memory service | `confidence = 1 - Π(1 - r_i)` over **distinct provenance clusters** only. Same-source repeat → no confidence gain. |
| **Subsumption + scope + modality checks at write (A7, B3, B5)** | extend extraction LLM call | 5-way: `entails / entailed-by / equivalent / contradicts / independent`; respect dimensional tags before flagging contradiction; never contradict across `claim_modality` values. |
| **Idempotency keys on every write (I2)** | extend memory service | `idempotency_key = hash(tenant_id, company_id, source_uri, content_hash)`. Second write returns first's id. |
| Decay cron | new `backend/app/jobs/decay.py` | Nightly; per-`decay_class` confidence reduction. **Resurrect-on-match (D5):** incoming fact matching a decayed memory resets decay rather than creates new. |
| Consolidation cron | new `backend/app/jobs/consolidate.py` | Weekly; cluster near-duplicates, summarize, merge |
| Dedup cron | new `backend/app/jobs/dedup.py` | Nightly; exact + near-duplicate detection on canonical-form proposition |
| **Reflection cron (T5, Generative Agents pattern)** | new `backend/app/jobs/reflection.py` | Periodic: read recent Session/Project memories → "what are 3 highest-importance insights?" → write as higher-importance memories at Company layer. Recursion depth capped at 3. **This is how the platform actually gets smarter.** |
| Job orchestration | new `backend/app/jobs/scheduler.py` | APScheduler or equivalent; per-tenant scheduling |

## Workstream 1.5 · Voice Intake (Meridian one-shot pattern)

| Deliverable | Touch point | Notes |
|---|---|---|
| Voice button on Home view | new `frontend/src/components/VoiceIntake.vue` | MediaRecorder → upload → transcribe |
| Intent parser with strict JSON schema | new `backend/app/services/intent_parser.py` | Mirror Meridian's `parseVoiceIntent` — strict schema + Pydantic validation |
| Entity resolution post-LLM | same | Fuzzy-match portco names against tenant's company list |
| Project draft preview | new `frontend/src/components/IntentPreview.vue` | User confirms before commit |

## Workstream 1.6 · Portco Onboarding Workflow

| Deliverable | Touch point | Notes |
|---|---|---|
| Onboarding wizard (GP-initiated) | new `frontend/src/views/PortcoOnboarding.vue` | Create Company → name/sector/geo → seed connectors stub → invite team |
| Onboarding voice intake | extend Voice Intake | "Tell me about this company" → seeds first 20-50 memory items |
| Initial document upload prompt | new component | Cap table, last board deck, latest financials, customer list — guides what to drop |
| Team invite flow | new `backend/app/auth/invites.py` | Generate scoped invite link for PortCoTeam role |

## Workstream 1.7 · User & Global Memory Layers

| Deliverable | Touch point | Notes |
|---|---|---|
| User memory namespace | extend memory service | GP's preferences, decision style, prior calls — cross-cuts companies |
| Global memory ingest | new `backend/app/services/global_memory.py` | Curated industry knowledge (Porter, JTBD, framework definitions) seeded by GP; read-only at runtime |
| Memory layer routing in retrieval | extend hybrid query | Query order: session → project → company → portfolio → global; user-layer overlays |

## Workstream 1.8 · Strategy Artifact Recognition (Share-and-Apply foundation, H13)

| Deliverable | Touch point | Notes |
|---|---|---|
| `StrategyArtifact` doc type in ingest pipeline | extend [text_processor.py](backend/app/services/text_processor.py) | Recognized via classification at ingest; tagged `type: external_strategy_artifact` |
| `StrategyArtifact` model | new `backend/app/models/strategy_artifact.py` | Fields: `title`, `source_url`, `artifact_type` (framework / playbook / thesis / case_study / maxim), `core_thesis`, `preconditions[]`, `key_moves[]`, `expected_outcomes[]`, `context_of_origin`, `attribution` |
| Extractor v0 | new `backend/app/services/strategy_extractor.py` | LLM with strict schema extracts structured artifact from raw text / transcript / vision-extracted slide |

This phase only **recognizes and structures** external strategies. Applying them to a portco happens in Phase 2.

## Workstream 1.9 · Public Data Tools (first 6)

| Tool | Source |
|---|---|
| `edgar_filings` | SEC EDGAR API (already in Phase 0; expand to fetch + parse) |
| `news_recent` | NewsAPI + Bing News |
| `patents_lookup` | Google Patents BigQuery |
| `macro_fred` | FRED API |
| `web_search_deep` | Tavily / Brave (already in Phase 0; expand to multi-query) |
| `web_fetch_render` | Playwright headless (already in Phase 0; add render path) |

## Phase 1 Acceptance Gate

- ✅ Drop a portco's annual report (PDF, 80 pages) — system extracts ≥ 50 memory items with full dimensional tags and provenance within $5 cost cap.
- ✅ Drop a chart-heavy slide deck — vision model extracts ≥ 3 quantitative claims correctly.
- ✅ Record a 90-second voice question — transcript correct, intent parsed, draft project created.
- ✅ Hybrid query "what do we know about Brazil B2B SaaS" returns memory items from across documents, ranked sensibly.
- ✅ Public data tools each return a working result on a test query.
- ✅ A new portco completes onboarding end-to-end in ≤ 30 minutes including doc uploads.
- ✅ Decay, consolidation, and dedup crons run for 7 consecutive nights without errors; consolidation merges ≥ 10 near-duplicates.
- ✅ Usage telemetry shows ingest used by ≥ 1 user weekly for 2 consecutive weeks.

## Phase 1 Risks

| Risk | Mitigation |
|---|---|
| GraphRAG entity duplication explodes graph | Dedup pass + entity consolidation cron (this phase) |
| Voice intent JSON schema too rigid for messy speech | Keep `confidence: low|medium|high`; surface low-conf to user for confirmation |
| Vision extraction unreliable on poor scans | Fallback to text-only; flag low-confidence items |
| Cost per ingest spikes with large PDFs | Pre-ingest estimator + page-level cost cap |
| Crons run unbounded on growing memory | Hard time budget per cron run; resume from cursor |

---

# PHASE 2 — Diagnosis + Research Mesh + Code Interpreter

**Duration:** 6–7 weeks
**Gate:** Ask a strategy question on a real portco; Diagnosis agent reframes it; 8 research agents run in parallel within $5 budget; findings stream into memory with confidence + provenance; user can intervene live; code interpreter runs a real financial calc.

**Within-phase sequence:** 2.1 (orchestration runtime) → 2.2 (Diagnosis) and 2.3 (research agents) in parallel → 2.4 (UI) and 2.5 (code interpreter sandbox) in parallel → 2.6 (contradiction review).

## Workstream 2.1 · Chief Strategist Orchestrator (H4)

| Deliverable | Touch point | Notes |
|---|---|---|
| Hierarchical orchestration runtime | new `backend/app/agents/runtime.py` | JSON handoff contracts, idempotent steps, resumable on crash, per-agent budgets |
| ChiefStrategist agent | new `backend/app/agents/chief_strategist.py` | Parses intent → builds research plan → dispatches with budgets; depends on runtime |
| Live progress streaming | extend [simulation_ipc.py](backend/app/services/simulation_ipc.py) | SSE / WebSocket stream of agent events to frontend |
| Workflow chaining support | runtime | Up to N=5 tool calls per agent turn (Meridian pattern) |

## Workstream 2.2 · Diagnosis Agent (P4)

| Deliverable | Touch point | Notes |
|---|---|---|
| Diagnosis agent | new `backend/app/agents/diagnosis.py` | Challenges framing; outputs `(reframed_question, question_type, suggested_frameworks, key_unknowns)` |
| Question taxonomy | new `backend/app/agents/diagnosis_taxonomy.py` | Adjacency / white-space / geo / M&A / pricing / capability / competitive-response / portfolio / scenario / custom |
| User-facing diagnosis review | new `frontend/src/components/DiagnosisReview.vue` | User accepts/edits reframed question before research starts |

## Workstream 2.3 · Research Specialist Agents

New files in `backend/app/agents/research/`. Each: scoped tool belt, output schema, budget envelope.

| Agent | Tools | Output |
|---|---|---|
| `market_researcher` | edgar, news, web, fred | Market size, growth, structure, top players |
| `competitor_analyst` | edgar, news, web_fetch, patents | Competitor profiles, moves, weaknesses |
| `customer_researcher` | reviews, social, internal_crm (stub until Phase 5) | JTBD, sentiment, segments |
| `tech_scout` | patents, arxiv, github, news | S-curves, threats, opportunities |
| `regulatory_analyst` | gov registers, news, web | Active regs, pending, jurisdiction risk |
| `macro_analyst` | fred, world_bank, news | Rates, FX, geopolitics relevant to question |
| `talent_analyst` | hiring sites, web | Talent supply, comp benchmarks |
| `internal_data_analyst` | portco connectors (stubs until Phase 5) | First-party insight (limited until connectors live) |

## Workstream 2.4 · Live Steering UI

| Deliverable | Touch point | Notes |
|---|---|---|
| Agent tree visualization | new `frontend/src/views/ResearchLive.vue` | Each agent's status, sources gathered, partial findings |
| Mid-flight steering | same | User can pause, add context, redirect, kill |
| Source inspector | same | Click any claim → see source → see reasoning chain |

## Workstream 2.5 · Code Interpreter Sandbox

| Deliverable | Touch point | Notes |
|---|---|---|
| Sandbox provider integration | new `backend/app/tools/code_interpreter.py` | Vendor decision (OD11 — E2B / Modal / Daytona); execution isolated per session |
| Financial model templates | new `backend/app/code_templates/` | NPV, sensitivity, scenario tree, CAC payback, cohort retention |
| Code interpreter as MCP tool | extend MCP gateway | Available to all agents that can request it |

## Workstream 2.6 · Contradiction Review

| Deliverable | Touch point | Notes |
|---|---|---|
| Contradiction review UI | new `frontend/src/views/Contradictions.vue` | Lists open contradictions; GP/Operator resolves with one of 4 outcomes |
| Auto-flagging during research | extend research agents | New finding contradicting high-confidence memory → creates Contradiction edge |
| Resolution flow | extend memory service | On resolve, loser memory item is `superseded`; winner gains reinforcement |

## Workstream 2.7 · Multi-Hop Retrieval (HippoRAG, T8, E6)

Most strategy queries ("what initiatives in portco A resemble the winning pattern in portco B?") are intrinsically multi-hop. Vanilla vector retrieval underperforms.

| Deliverable | Touch point | Notes |
|---|---|---|
| Query classifier | new `backend/app/services/query_classifier.py` | Classifies incoming queries as `lookup` (single-hop, fast hybrid path) vs `multi-hop / analogy` (PPR path). Cheap LLM call or learned classifier. |
| Personalized PageRank engine | new `backend/app/services/ppr.py` | Single-hop ANN finds seed entities → PPR diffusion over entity graph → multi-hop passage retrieval. Inspired by OSU-NLP-Group/HippoRAG. |
| PPR-aware hybrid fusion | extend `rerank.py` | When query classifier routes to multi-hop, PPR results join RRF fusion |

## Workstream 2.8 · Share-and-Apply (apply external strategy to a portco, H13)

Builds on Phase 1's strategy artifact recognition (Workstream 1.8). Adds the *application* engine.

| Deliverable | Touch point | Notes |
|---|---|---|
| Fit Assessment agent | new `backend/app/agents/fit_assessment.py` | Scores each precondition + key_move from a `StrategyArtifact` against target portco's known capabilities, segments, geos. Outputs `fit_score (0-100)` + `gap_list` with evidence |
| Adaptation agent | new `backend/app/agents/adaptation.py` | Rewrites moves customized for portco's context; surfaces synergy candidates from other portcos that fill gaps |
| Application orchestrator | new `backend/app/services/share_and_apply.py` | Pipeline: artifact → fit → adapt → optionally invoke micro-war-game (Phase 3) → memo |
| Application memo template | new `backend/app/templates/application_memo.md` | Briefing-default (H6) 1-page output: thesis, fit score with reasoning, adapted playbook, risks, suggested next steps |
| Drop-and-apply UI | new `frontend/src/views/ApplyStrategy.vue` | Paste / upload / URL → pick target portco → run; preview of extracted artifact before apply |
| Portfolio scan mode | extend orchestrator | "Apply to all" — ranks portcos by fit score; outputs portfolio-level applicability map (GP only) |
| Application → prediction ledger | extend `prediction.py` | Each application records a prediction with `framework: "external_artifact"` and `attribution` field; outcomes calibrated like any framework |

## Phase 2 Acceptance Gate

- ✅ Real strategic question asked on real portco → Diagnosis agent reframes sensibly (verified by user).
- ✅ 8 research agents run in parallel, complete within $5 token budget, return structured findings.
- ✅ All findings land in memory with confidence + provenance; user audits any claim back to source.
- ✅ User intervenes mid-run; system honors the steer within 5 seconds.
- ✅ Code interpreter executes a real NPV calculation on portco data.
- ✅ At least one contradiction is flagged, surfaced, and resolved by user.
- ✅ **Drop an HBR article → pick TestCo → application memo generates with fit score, adapted moves, and risks within $3 budget.**
- ✅ **Portfolio scan on a thesis returns ranked applicability across ≥ 2 portcos.**
- ✅ Usage telemetry shows ≥ 1 research session per week for 3 consecutive weeks.
- ✅ Usage telemetry shows ≥ 1 Share-and-Apply use per week for 3 consecutive weeks.

## Phase 2 Risks

| Risk | Mitigation |
|---|---|
| Parallel agent fanout blows budget | Hard cap on parallelism (start at 8); escalate only with justification |
| Research findings contradict each other unproductively | Contradiction tracking surfaces to user, not auto-resolved |
| Agents loop or hang | Idempotent resumable steps; hard kill at 1.5× time budget |
| Internal connectors not yet built | Internal-data analyst stubs return "not connected"; real connectors in Phase 5 |
| Code interpreter security | Vendor isolation; no network egress by default; per-session credentials only |

---

# PHASE 3 — Reasoning Mesh + Simulation + Cross-Co War-Game

**Duration:** 7–8 weeks
**Gate:** A reframed question produces 5-12 options with MCDA + red-team + OASIS war-game playback; a cross-company war-game demos two portcos in a shared scenario; war-game outcomes seed short-horizon predictions in the ledger.

## Workstream 3.1 · Framework Library (H1, P4)

System-selected, not user-picked. New files in `backend/app/agents/frameworks/`:

| Framework | Output schema |
|---|---|
| `porter_5_forces` | Forces table + threat scores |
| `ansoff_matrix` | Existing/new × market/product placement |
| `jtbd` | Jobs / pains / gains / segments |
| `wardley_map` | Components × evolution stage + edges |
| `three_horizons` | Initiatives in H1/H2/H3 with allocations |
| `bcg_matrix` | Share × growth grid |
| `blue_ocean` | Value curve + four-actions framework |
| `disruption_lens` | Sustaining vs disruptive scoring |

Each: declarative system prompt + input schema + output schema + visualization template. Diagnosis agent picks subset; do not run all 8 by default.

## Workstream 3.2 · Option Generator + MCDA Evaluator

| Deliverable | Touch point | Notes |
|---|---|---|
| Option generator (divergent + convergent ensemble vote) | new `backend/app/agents/option_generator.py` | 3 models vote; merges unique high-quality options |
| MCDA evaluator | new `backend/app/agents/mcda_evaluator.py` | Weighted scoring on 8 criteria; outputs predictions to ledger |
| Sensitivity analysis | same | Vary weights ±20%; show weight-robust options |

## Workstream 3.3 · Red-Team / Critic (H4)

| Deliverable | Touch point | Notes |
|---|---|---|
| Red-team agent with model-diversity ensemble | new `backend/app/agents/red_team.py` | Claude + GPT-5 + Gemini independently attack; merge unique critiques |
| Devil's advocate persona pack | new prompts | Contrarian, regulator's view, incumbent response, founder skeptic |

## Workstream 3.4 · Simulation Arena Upgrade + TTS Playback

| Deliverable | Touch point | Notes |
|---|---|---|
| Stakeholder persona packs | extend [oasis_profile_generator.py](backend/app/services/oasis_profile_generator.py) | Customer archetype, competitor CEO, regulator, channel partner, investor, top-talent candidate |
| Multi-arena support | extend [simulation_runner.py](backend/app/services/simulation_runner.py) | Customer / talent / capital / regulator |
| War-game scenarios | new `backend/app/services/war_game.py` | Shocks: FX, new entrant, regulation, supply chain |
| War-game playback UI | new `frontend/src/views/WarGame.vue` | Step-through with persona avatars + transcripts |
| **TTS playback of war-game dialogue** | new `backend/app/voice/tts_playback.py` | ElevenLabs voice per persona; user can play turn-by-turn audio |
| Outcome → ledger (short-horizon) | extend [report_agent.py](backend/app/services/report_agent.py) | Every war-game outcome creates immediate-horizon prediction entries (closeable within hours/days), feeds Phase 6 calibration data |

## Workstream 3.5 · Share-and-Apply Micro War-Game (H13 deep mode)

Extends Phase 2's Share-and-Apply pipeline with optional simulation stress-testing.

| Deliverable | Touch point | Notes |
|---|---|---|
| Micro war-game option in Apply UI | extend [ApplyStrategy.vue](frontend/src/views/ApplyStrategy.vue) | "Deep mode" toggle — runs a quick simulation in the target portco's customer arena |
| Adapter from `StrategyArtifact` to war-game scenario | extend [war_game.py](backend/app/services/war_game.py) | Maps key_moves to scenario shocks; preserves attribution in outcomes |
| Comparative output | extend application memo template | Adds "Simulated outcome vs expected" section when deep mode is used |

## Workstream 3.6 · Cross-Company War-Game

| Deliverable | Touch point | Notes |
|---|---|---|
| Cross-company scenario builder | new `backend/app/services/cross_co_scenario.py` | GP only; deliberate opt-in per company |
| Synergy stress test | same | "Both portcos depend on supplier X — supplier gets acquired by Y. Outcomes?" |
| Permissioning gate | enforce in API layer + query layer + UI | Three-layer enforcement; audit log on every cross-co read |

## Phase 3 Acceptance Gate

- ✅ Diagnosed question produces 5-12 options with MCDA scoring.
- ✅ Red-team produces non-trivial critiques on ≥ 70% of options (verified by GP).
- ✅ War-game runs in a chosen arena and produces a ≤ 5-minute playback.
- ✅ Cross-company war-game runs across 2 portcos and surfaces ≥ 1 non-obvious synergy or risk.
- ✅ Every option and war-game outcome is in the prediction ledger; war-game outcomes have target_dates within the simulation horizon.
- ✅ TTS playback of war-game audio works smoothly for ≥ 3 personas.
- ✅ Usage telemetry shows full reasoning pipeline run on a real question ≥ 1× per week for 4 weeks.

## Phase 3 Risks

| Risk | Mitigation |
|---|---|
| Framework outputs feel mechanical | Diagnosis picks fewer, more relevant frameworks; never all 8 |
| MCDA scoring feels arbitrary | Show weight sensitivity; expose weights for GP customization |
| War-game personas feel generic | Persona packs per industry (initial: SaaS, fintech, consumer; others later); fine-tuning track in Phase 4/8 |
| Cross-co data leakage risk | Permission check at three layers (UI, API, query); audit log; GP role required |
| TTS cost spikes | Cache common voices; tiered model (Eleven Flash for previews, full quality on user request) |

---

# PHASE 4 — Brainstorm Mode + Multimodal + Realtime Voice + Hot-Path Distillation

**Duration:** 5–6 weeks
**Gate:** A 30-min voice brainstorm produces populated draft tray (≥ 15 items, ≥ 80% useful); persona swap works mid-session; vision extraction on real deck ≥ 80% accurate; hot-path costs drop ≥ 5× vs Phase 2 baseline.

## Workstream 4.1 · Realtime Voice Abstraction (Meridian patterns, H3)

This is the realtime channel deferred from Phase 0 LLM router; separate abstraction.

| Deliverable | Touch point | Notes |
|---|---|---|
| Realtime provider interface | new `backend/app/voice/provider.py` | Swap OpenAI Realtime ↔ Gemini Live ↔ Anthropic (when available) |
| WebRTC realtime connection | new `backend/app/voice/realtime.py` + `frontend/src/voice/` | Ephemeral token flow, semantic VAD with `interrupt_response: true` |
| Session lock with TTL | new `backend/app/voice/sessions.py` | 1 session per user, 5-min TTL, client-side stale-lock recovery |
| Voice mini-player | new `frontend/src/components/VoiceMiniPlayer.vue` | `isCallActive` ≠ `isOverlayOpen`; persists across navigation |
| PTT fallback | same | Press-and-hold for noisy environments |
| Visual feedback | same | Waveform, badges, haptics |
| Safety net for stuck states | extend realtime.py | No `response.created` within 3s → send `response.create` (Meridian pattern) |

## Workstream 4.2 · Brainstorm Mode (4 phases)

| Deliverable | Touch point | Notes |
|---|---|---|
| Phase state machine (Diverge → Probe → Sharpen → Lock) | new `backend/app/voice/brainstorm.py` | Voice-triggered or AI-suggested transitions |
| Phase-specific prompts | new `backend/app/voice/brainstorm_prompts/` | 4 prompts + base; static-prefix / user-suffix for caching |
| Capture extractors (5 silent tools) | new `backend/app/voice/extractors.py` | `capture_hypothesis`, `capture_option`, `capture_assumption`, `capture_risk`, `capture_open_question` |
| Draft tray | new `frontend/src/views/BrainstormReview.vue` | Post-session confirm / edit / reject |
| Brainstorm map visualization | same | Hypotheses → options ← assumptions ← risks |
| AI recap card | new `backend/app/voice/recap.py` | Auto-runs at session close; "You returned to X 3 times; you assumed Y; Z is unresolved" |
| Suggested next moves | same | "Want deep research on X?" / "War-game option 2?" |

## Workstream 4.3 · Voice Triggers for Share-and-Apply (H13)

| Deliverable | Touch point | Notes |
|---|---|---|
| Voice command grammar | extend [voice/realtime.py](backend/app/voice/realtime.py) | "Apply this to TestCo" while a `StrategyArtifact` is in session context; "Scan the portfolio for fit on this" |
| Brainstorm mode integration | extend [brainstorm.py](backend/app/voice/brainstorm.py) | During Sharpen phase, "What would [Bezos's day-1 / Christensen disruption / Drucker on innovation] look like for us?" — system retrieves matching artifact from global memory or extracts from voice + runs apply pipeline |
| Application result spoken back | extend [voice/recap.py](backend/app/voice/recap.py) | TTS reads fit score + top 3 adapted moves + biggest risk |

## Workstream 4.4 · Persona Swap Mid-Session

| Deliverable | Touch point | Notes |
|---|---|---|
| Persona registry | new `backend/app/voice/personas.py` | Coach, Challenger, Devil's Advocate, Consultant, Chief-of-Staff, + stakeholder personas from Phase 3 |
| Mid-flight instruction swap | extend `voice/realtime.py` | Inject new system prompt + voice config without dropping session |
| "Talk to any agent" UI | extend Brainstorm view | Voice command: "let me hear from the regulator" — swaps persona + voice |

## Workstream 4.5 · Multimodal In/Out

| Deliverable | Notes |
|---|---|
| Drop slides → vision extracts (already in Phase 1; integrate to voice context) | Voice copilot can reference slides on screen |
| Drop whiteboard photos → diagram extraction | Vision returns structured graph |
| Generate Wardley / Porter / BCG / 3H diagrams | new `backend/app/visualizations/` — structured layout + Imagen 4 / Flux for stylized exports (OD9) |
| Memo dictation surface | new `frontend/src/views/MemoDictation.vue` | One-shot record → AI structures into 1-page memo |

## Workstream 4.6 · Hot-Path Distillation (H5)

| Deliverable | Notes |
|---|---|
| Identify hot paths | Extraction, classification, intent parsing, dimensional tagging, dedup |
| Collect frontier-model labels for training set | 5K-50K examples per hot path; harvested from Phase 1-3 real usage |
| Fine-tune small model per hot path | Llama 3.1 8B / Gemma 2 9B / DeepSeek small via vLLM (OD10) |
| Behind-the-router swap | Configure router to prefer distilled for hot tasks |
| Quality monitoring | Sample 1% through frontier; alert on >10% drift |
| Fallback for insufficient data | If hot path has < 5K examples, keep frontier model; re-evaluate Phase 6 |

## Phase 4 Acceptance Gate

- ✅ 30-min voice brainstorm completes without echo loops or session drops.
- ✅ Draft tray contains ≥ 15 items across 5 categories; ≥ 80% rated useful.
- ✅ Persona swap mid-session works within 2s latency.
- ✅ Vision extraction on real portco deck yields ≥ 80% accurate quantitative claims.
- ✅ Memo dictation surface produces a usable 1-page memo from a 3-min monologue.
- ✅ Distilled models handle hot paths at ≥ 90% of frontier quality, ≥ 5× cheaper (for paths with sufficient data).
- ✅ GP runs ≥ 1 strategy brainstorm via voice per week for 4 weeks.

## Phase 4 Risks

| Risk | Mitigation |
|---|---|
| Realtime voice provider quirks | Provider abstraction + Meridian's "no response in 3s" safety net |
| Distillation quality regression | Shadow-test 1% through frontier; auto-revert if drift >10% |
| Brainstorm captures noise | Confidence floor; bulk-dismiss; AI recap surfaces signal |
| Persona swap latency | Pre-warm common personas; cache instruction prompts |
| Insufficient distillation data | Fall back to frontier; re-evaluate quarterly |

---

# PHASE 5 — Strategy → Execution Bridge + Operator UX Tier

**Duration:** 7–8 weeks
**Gate:** A real strategy artifact decomposes into initiatives → OKRs → tasks; tasks sync to a portco's actual Linear; status flows back; one drift detector fires correctly; operator tier UX ships and an operator uses Slack bot ≥ 2×/week.

**Within-phase sequence:** 5.1 (decomposition) → 5.2a (Linear connector first, just one) → 5.3 (KPI sync, depends on connectors) → 5.4 (drift detection, depends on KPIs + connector status) → 5.5 (operator UX, can run parallel with 5.4) → 5.2b (add Jira, Notion incrementally after Linear stabilizes).

## Workstream 5.1 · Decomposition

| Deliverable | Touch point | Notes |
|---|---|---|
| Strategy decomposer | new `backend/app/services/decomposer.py` | Thesis → 3-5 initiatives → OKRs → workstreams → tasks |
| Initiative model | new `backend/app/models/initiative.py` | `expected_impact`, `cost_estimate`, `confidence`, `dependencies`, `prediction_id` |
| OKR model | new `backend/app/models/okr.py` | Objective + 2-5 KRs; leading + lagging indicators |
| Capability staffing recommender | new `backend/app/services/staffing.py` | Surfaces internal + portfolio capabilities |
| Investment allocation view | new `frontend/src/views/InvestmentAllocation.vue` | Per-initiative cost / return / confidence; portfolio split |
| Pre-mortem launch ritual | new `backend/app/services/pre_mortem.py` | Required before initiative goes "active"; produces risk register |
| Decomposer challenger | extend decomposer | Diagnosis-style LLM challenges output before commit (avoid vague OKRs) |

## Workstream 5.2 · Execution Tool Sync (sequenced)

| Order | Connector | Direction | Phase position |
|---|---|---|---|
| 1 | Linear | bi-directional | Ship first; stabilize 2 weeks |
| 2 | Notion | bi-directional | After Linear stable |
| 3 | Jira | bi-directional | After Notion stable |
| 4 | Asana | bi-directional | Deferred to backlog if Phase 5 over-runs |
| 5 | GitHub Projects | one-way (push) | Deferred to backlog |
| 6 | Monday | one-way (push) | Deferred to backlog |

| Deliverable | Notes |
|---|---|
| Connector framework | Common interface; per-portco credentials; version-pinned client libs |
| Stable ID mapping | `initiative_id ↔ tool_id`; survives renames |
| Sync cron | Nightly + on-demand; conflict resolution rules documented |
| Connector permissions UI | Per-portco; granular scopes |
| Connector health monitor | Alert on auth failure / schema drift |

## Workstream 5.3 · KPI Sync (depends on 5.2.1+)

| Source | Phase position |
|---|---|
| Stripe | Ship first (highest-leverage signal) |
| GA4 | Second |
| Salesforce / HubSpot | Third (CRM) |
| Snowflake / BigQuery / internal DB | Fourth (custom warehouse) |

| Deliverable | Notes |
|---|---|
| KPI definition library | Reusable: CAC, payback, NRR, ARR, etc. |
| Auto-mapping to OKR key results | LLM matches available metrics to declared KRs |
| Daily snapshot to prediction ledger | Every KR has time-series; outcomes auto-populate where possible |

## Workstream 5.4 · Drift Detection (depends on 5.3)

| Detector | Logic |
|---|---|
| Schedule drift | % behind plan; rate of slippage; replan needed? |
| KPI drift | Leading indicator divergence; statistical significance with min sample size |
| Thesis drift | Underlying assumption invalidated; contradiction count crosses threshold |

| Deliverable | Notes |
|---|---|
| Drift detector crons | Nightly; per-detector; hysteresis to avoid flapping |
| Drift dashboard | Per-portco; alerts on threshold |
| Replan engine | Proposes: Continue / Adjust pace / Pivot / Kill; logged as decision with prediction |
| **Synthetic drift test fixture** | Test data path that manufactures a drift event for E2E verification |

## Workstream 5.5 · Operator UX Tier (P7) — ships in this phase

| Surface | Notes |
|---|---|
| Slack bot | `/strategy ask`, `/strategy status`, daily digest; rich-text reply |
| Notion sidebar | Strategy artifacts visible from operator's working doc |
| Linear integration | Strategy context on tasks; AI-generated weekly status from Linear updates |
| Email digest | Weekly board-ready 1-pager (briefing-default policy) |
| Operator-tier home (web) | Simplified vs. GP tier: voice intake + projects list + drift alerts |

## Phase 5 Acceptance Gate

- ✅ Real strategy artifact decomposes into 3-5 initiatives with 8-15 total OKRs.
- ✅ ≥ 50% of OKRs auto-map to KPIs in a connected source.
- ✅ Tasks sync to portco's Linear; status flows back within 24h of changes.
- ✅ A real drift event fires correctly (or synthetic test event if no real drift naturally occurs); sensible replan proposal generated.
- ✅ One pre-mortem ritual completes on a real new initiative.
- ✅ An operator uses Slack bot or Notion sidebar ≥ 2× per week for 4 weeks (telemetry-verified).

## Phase 5 Risks

| Risk | Mitigation |
|---|---|
| Decomposition produces vague OKRs | Decomposer challenger pass; require ≥ 1 quantitative KR per O |
| Connectors break on API changes | Version pinning; alert on failure; health monitor |
| Drift detectors flap | Hysteresis + min sample size + change-point detection |
| Operators ignore embedded surfaces | Voice fallback always available; soft weekly check-in prompt |
| Sequential connector buildout slows Phase 5 | Linear-only is the gate; others move to backlog if needed |

---

# PHASE 6 — Learning Loop Activates

**Duration:** 6–7 weeks
**Gate:** First calibration scorecard generated from ≥ 20 closed predictions (war-game shorts + KPI mappings provide enough); first auto-distilled playbook published; first causal-lite post-mortem completed; anti-hallucination audit runs nightly.

## Workstream 6.1 · Calibration Cron (with proper scoring rules per [MEMORY_AND_LEARNING_REVIEW.md](./MEMORY_AND_LEARNING_REVIEW.md))

| Deliverable | Notes |
|---|---|
| Outcome resolver | For predictions whose horizon has passed, fetch actuals from KPIs / manual log / war-game closes. **Tag `outcome_class: real \| synthetic` separately (J4).** |
| Calibration computer | Error per (framework × dimension × model × persona × agent). **Proper scoring (T10, C25):** Brier score for probabilistic predictions + resolution (sharpness) score to penalize uninformative hedging (J3 Goodhart). Squared error / MAPE for point predictions. **Tracked separately by scoring method (J9).** |
| **Stratified calibration (J1)** | By horizon class (short / medium / long); by dimension; by source-trust tier. Surfaces survivorship bias when short-horizon dominates closed set. |
| **Open-but-stale prediction dashboard (J1)** | Predictions with passed `target_date` but no outcome — explicitly counted. Domains with high open-rate flagged. |
| **Intervention-vs-counterfactual cohorts (J2)** | Calibrate predictions where `intervention_taken=true` separately from un-intervened. Prevents "the forecast was wrong because we acted on it" miscalibration. |
| **Rolling-window calibration (J6)** | 90d / 365d / all-time windows; older outcomes time-decayed. |
| **Bayesian priors for sparse classes (J8)** | When in-class N < 10, use Bayesian aggregation across similar decision classes with explicit uncertainty bands. |
| **Decision evaluation track (J10)** | Separate from prediction calibration. Decisions evaluated on outcome + counterfactual judgment by GP. Decision quality ≠ prediction accuracy. |
| Calibration dashboard | Per-framework hit rate; per-agent accuracy; trend over time; per-scoring-method breakdown; open-rate per domain |
| Prior update mechanism | Calibration metadata fed back to agent runtime as `evidence_prior` field; agents read priors when reasoning |

## Workstream 6.2 · Pattern Mining

| Deliverable | Notes |
|---|---|
| Cross-project pattern miner | Finds recurring decision structures and their outcomes |
| Anti-pattern detector | Flags repeated failure shapes |
| Surfacing rules | New project matching a pattern trigger → pattern surfaced with calibration |

## Workstream 6.3 · Playbook Engine (Voyager-style, T11, M1-M3)

| Deliverable | Notes |
|---|---|
| Playbook schema | `trigger_conditions`, `steps`, `gates`, `evidence`, `outcomes`, `calibration`, `evidence_diversity_score` |
| Playbook auto-draft | LLM drafts from clustered patterns; GP reviews before publish; requires ≥ 3 evidence projects |
| **Voyager-style outcome-gated promotion (T11, M3)** | A playbook is only promoted from Project-layer → Company → Portfolio after passing an outcome check from the Prediction Ledger. Mirrors Voyager's skill verification. |
| **Diversity requirement (M1)** | Evidence projects must span ≥ 2 industries OR ≥ 2 geos OR ≥ 2 stages before Portfolio-layer promotion. Prevents portco-idiosyncrasy overfitting. |
| **Stale playbook retirement (M2)** | Per-playbook hit rate computed by calibration cron; auto-archive at < 30% hit rate after 6 months. |
| **Automatic curriculum (T11)** | System proposes which playbook gap to fill next, bounded by portfolio relevance (not novelty for novelty's sake). |
| Playbook execution helper | When triggered, scaffolds project pre-populated with playbook steps |

## Workstream 6.4 · Causal-Lite Attribution

| Deliverable | Notes |
|---|---|
| Attribution agent | For each completed initiative: variables changed, plausible counterfactual, credit assignment |
| Auto-draft post-mortem | "What worked / What didn't" from data + execution log + transcripts; framed as hypotheses |
| Lesson extraction → memory | High-signal lessons land in procedural memory |

## Workstream 6.5 · Anti-Hallucination Audit (Constitution-based, T9, N3)

| Deliverable | Notes |
|---|---|
| **Constitutional principle list** | new `backend/app/jobs/audit_constitution.py`. Explicit principles: "every numeric claim cites a source memory"; "every prediction specifies horizon + confidence"; "every cross-portco analogy names both sides"; "every causal claim names plausible confounders". Audit measures principle-compliance, not vibes. |
| **Priority-sampled audit (N2)** | High-confidence + high-decay-class items sampled more frequently than low-conf low-decay. Sample 1-5% per night within budget cap. |
| Memory audit cron | Nightly sample; re-verify against fresh sources |
| Drift detector for memory | Items whose source has changed → confidence degraded |
| Stale memory archive | Items below confidence floor moved to "historical"; not retrieved by default |

## Workstream 6.6 · Causal Attribution with Confounder DAGs (L1, L3, L4)

| Deliverable | Notes |
|---|---|
| Hand-curated confounder DAG per industry | new `backend/app/causal/dags/` | Per-industry directed acyclic graph of known confounders (e.g., for B2B SaaS: macro rates, hiring market, AI-disruption). Attribution agent **must** condition on these. |
| Pattern-level (not portco-level) attribution calibration | extend calibration cron | Calibrate at pattern level so cross-portco contamination doesn't mis-credit. |
| **No-success-only training (L4)** | Hard rule for procedural memory updates: every training batch includes failure traces with explicit failure-mode labels. Implements anti-pattern AP6. |

## Phase 6 Acceptance Gate

- ✅ First calibration scorecard shows hit rates per framework / model with ≥ 20 closed predictions.
- ✅ One auto-drafted playbook is published by GP after review.
- ✅ One causal-lite post-mortem completes on real initiative; operator confirms it captures the lesson.
- ✅ Memory audit catches and degrades ≥ 1 stale claim per week.

## Phase 6 Risks

| Risk | Mitigation |
|---|---|
| Not enough closed predictions | War-game short-horizon predictions seeded in Phase 3; KPI snapshots from Phase 5 |
| Causal attribution is noisy | Frame outputs as hypotheses; require operator confirmation |
| Playbook auto-drafts feel generic | Require ≥ 3 evidence projects; GP curates |
| Audit cron costs spike | Sample (1-5%), don't full-scan; budget cap |

---

# PHASE 7 — Portfolio + Synergy + Voice Briefing

**Duration:** 5–6 weeks
**Gate:** ≥ 3 portcos onboarded with active projects; Synergy Scout detects ≥ 3 high-value candidates monthly; portfolio dashboard live; daily/weekly voice briefing runs for GP.

**Prerequisite check:** Before Phase 7 begins, verify ≥ 3 portcos are onboarded and have ≥ 1 active project each. If not, extend Phase 5/6 with portco-onboarding push.

## Workstream 7.1 · Synergy Scout (9 detectors)

Each detector new in `backend/app/portfolio/detectors/`:

| Detector | Signal |
|---|---|
| `capability_overlap` | Skill/IP/tech complementarity |
| `customer_overlap` | Named accounts or ICP overlap |
| `supplier_overlap` | Joint procurement leverage |
| `channel_overlap` | Distribution / partner crossover |
| `geographic_overlap` | Shared GTM infra |
| `talent_overlap` | Hiring pools, leadership |
| `tech_ip_overlap` | Shared platforms, licensable IP |
| `capital_structure` | Refi, shared lenders |
| `macro_exposure` | Correlated risks |

## Workstream 7.2 · Pattern Distillation (P12)

| Deliverable | Notes |
|---|---|
| Anonymization layer | Strip identifying details before patterns cross company boundary; min N=3 portcos before publication |
| Aggregate statistics generator | "SaaS portcos N=4 hit payback at median 14mo" |
| Surfacing rules | New project matching → pattern auto-surfaced without identifying source portcos |

## Workstream 7.3 · Portfolio Dashboard (GP only)

| Surface | Notes |
|---|---|
| Thesis health per portco | Drift indicators, confidence, last review |
| Synergy candidates queue | Triage view; publish / dismiss |
| Calibration scorecard | Cross-portco framework / agent performance |
| Playbook hits | Which playbooks fired on which projects, outcomes |
| Investment allocation | Capital + effort across portcos and initiatives |
| **Portfolio investment thesis editor** | GP authors the portfolio-level thesis; agents reference it |
| Default view | "What needs your attention this week" |

## Workstream 7.4 · Cross-Company Playbook Surfacing

| Deliverable | Notes |
|---|---|
| Match engine | New project context matched against playbook triggers |
| Confidence-weighted surfacing | Only above threshold; show evidence count and calibration |
| Permission gate | Portco sees only portfolio-curated playbooks, never raw source projects |

## Workstream 7.5 · Applied Strategy Library (Share-and-Apply cross-portco, H13)

After 6+ months of Share-and-Apply use accumulated across portcos, the platform has empirical data on which external playbooks actually worked. This workstream surfaces that as portfolio-level intelligence.

| Deliverable | Touch point | Notes |
|---|---|---|
| Applied Strategy Library view | new `frontend/src/views/AppliedStrategies.vue` | GP-only; lists every `StrategyArtifact` ever applied, with portco anonymized, fit score, outcome, calibration delta |
| Library miner | new `backend/app/portfolio/applied_library.py` | Aggregates calibration across applications of the same artifact; surfaces "Strategy X has been applied 4 times across portfolio: 2 successes, 1 partial, 1 failure" |
| Application recommendations | extend playbook engine | When a new project's diagnosis matches an applied-strategy pattern, the library surfaces the prior application's outcome as evidence |
| Auto-apply suggestion | new orchestration trigger | When an externally-shared artifact matches the GP's portfolio thesis, system proactively suggests "Apply this across portcos X, Y, Z?" |

## Workstream 7.6 · Voice Briefing (Daily / Weekly)

| Deliverable | Notes |
|---|---|
| Daily briefing builder | new `backend/app/voice/briefings.py` — derived from overnight signals, drift, synergy queue, calibration deltas |
| Weekly briefing builder | same — board-style synthesis across portfolio |
| TTS audio digest | ElevenLabs voice; downloadable / streamable |
| Voice interaction during briefing | Pause, ask follow-up; uses Phase 4 realtime channel |

## Phase 7 Acceptance Gate

- ✅ ≥ 3 portcos onboarded with active projects.
- ✅ Synergy Scout detects ≥ 3 high-value candidates in a month (verified non-obvious by GP).
- ✅ ≥ 1 synergy candidate published and acted on between portcos.
- ✅ New project on portco X surfaces a relevant playbook distilled from portco Y, without identifying Y.
- ✅ Portfolio dashboard used by GP ≥ 3×/week (telemetry-verified).
- ✅ Daily voice briefing runs for 14 consecutive days; GP listens ≥ 5×/week.

## Phase 7 Risks

| Risk | Mitigation |
|---|---|
| Anonymization leaks identity | Min N=3 before pattern publication; remove specific dollar amounts / dates |
| Too many low-signal synergies | Confidence threshold + feedback loop demotes false positives |
| GP overwhelmed by dashboard | Default = "what needs your attention this week" |
| Insufficient portcos at Phase 7 start | Extend Phase 5/6 with onboarding push before starting Phase 7 |
| Briefing fatigue | Configurable cadence; user can skip a day |

---

# PHASE 8 — Harden, Optimize, On-Prem Lane

**Duration:** 6–8 weeks
**Gate:** P95 latency targets met; cost-per-session within explicit numeric budget; on-prem model lane proven on a most-confidential portco; docs and runbooks complete.

## Workstream 8.1 · Performance

- Caching layers (semantic for research; result for repeated frameworks)
- Streaming everywhere
- Embedding cache (per-tenant)
- Concurrency tuning per agent class

## Workstream 8.2 · Cost Optimization

- Extend Phase 4 hot-path distillation to additional medium-volume tasks
- Prompt compression (semantic / structural)
- Tiered model defaults per surface
- Per-tenant cost SLO ($X/active-project/month — value set per OD12)

## Workstream 8.3 · On-Prem Model Lane (P5)

| Deliverable | Notes |
|---|---|
| vLLM server deployment | Llama 4 / DeepSeek / Qwen (OD10); GPU spec per OD12a |
| Per-portco routing config | Most-confidential portcos route to on-prem |
| Quality benchmarking | Per-task A/B against frontier; document gaps |
| Fallback to frontier with redaction | If on-prem unavailable, ultra-redacted call to frontier |

## Workstream 8.4 · Docs & Runbook

- Architecture decision records (ADRs) for every major choice
- On-call runbook
- Disaster recovery drill (full restore exercise)
- Per-portco onboarding guide
- Operator onboarding video / walkthrough

## Workstream 8.5 · Monitoring & Alerting

- SLO definitions per surface
- Pager rotation
- Synthetic checks for critical flows (intake, research, brainstorm, sync)

## Phase 8 Acceptance Gate

- ✅ P95 latencies: research session ≤ 90s; voice turn ≤ 1s; brainstorm tray render ≤ 2s; sync round-trip ≤ 5 min.
- ✅ Cost per typical strategy session ≤ $X (X set per OD12 before phase starts).
- ✅ On-prem lane handles a confidential portco's full session without external calls; quality drop ≤ 15% vs frontier on benchmark.
- ✅ Restore-from-backup drill succeeds end-to-end.
- ✅ Every major architecture decision has an ADR.

---

# Cross-Cutting Workstreams (continuous, not phase-bound)

## CC1 · Security & Compliance Hygiene
- Quarterly security review
- Per-portco access audit
- Secret rotation
- Dependency vulnerability scan
- Audit log review

## CC2 · Cost Discipline
- Weekly cost review
- Monthly per-tenant budget reset
- Quarterly model price benchmarking → router config updates

## CC3 · Provider Diversity
- Maintain ≥ 2 working models per task class
- Quarterly drill: disable primary, run on backup, validate

## CC4 · Memory Hygiene (Phase 1 onward)
- Nightly decay + dedup
- Weekly consolidation
- Monthly schema review

## CC5 · User Feedback Loop
- In-product feedback widget on every surface
- Monthly user interview rotation across portcos
- Quarterly feature retro

## CC6 · Calibration Maintenance (Phase 6 onward)
- Weekly review of new closed predictions
- Monthly framework/model leaderboard
- Quarterly prior recalibration

---

# Estimates Summary

| Phase | Duration | Cumulative |
|---|---|---|
| 0 · Foundation | 3–4 wk | ~4 wk |
| 1 · Memory + Ingest + Hygiene | 5–6 wk | ~10 wk |
| 2 · Diagnosis + Research + Code Interp | 6–7 wk | ~17 wk |
| 3 · Reasoning + Simulation + Cross-Co | 7–8 wk | ~25 wk |
| 4 · Brainstorm + Multimodal + Distill | 5–6 wk | ~31 wk |
| 5 · Strategy → Execution + Operator UX | 7–8 wk | ~39 wk |
| 6 · Learning Loop | 6–7 wk | ~46 wk |
| 7 · Portfolio + Synergy + Briefing | 5–6 wk | ~52 wk |
| 8 · Harden + On-Prem | 6–8 wk | ~60 wk |

**Total to feature-complete:** ~52–60 weeks (12–14 months).
**Defensible alpha:** end of Phase 3 (~6 months).
**First learning loop output:** end of Phase 6 (~11 months).
**Portfolio synergy live:** end of Phase 7 (~12 months).

---

# Open Decisions (require explicit answer before relevant phase starts)

| # | Question | Decision needed by |
|---|---|---|
| OD1 | Cloud: AWS or GCP? | Phase 0 start |
| OD2 | Database + vector search | **RESOLVED 2026-05-21: MySQL** (Manus platform default — MySQL 8.x, TiDB-compatible). Relational layer = MySQL. Vector search = `json` embedding column + app-side cosine for Phase 0; migrate to Zep Cloud for the vector + temporal-graph layer in Phase 1. Apache AGE graph → replaced by Zep. Real requirement was vector similarity search, not Postgres specifically. |
| OD3 | Auth: Google Workspace OIDC, Auth0, or WorkOS? | Phase 0 |
| OD3a | Secrets vault: AWS Secrets Manager / GCP Secret Manager / Bitwarden / HashiCorp Vault? | Phase 0 |
| OD4 | LLM router: LiteLLM or custom thin layer? | Phase 0 |
| OD5 | Realtime voice: OpenAI Realtime first; Gemini Live as backup? | Phase 4 |
| OD6 | Long-form transcription vendor: AssemblyAI vs Deepgram? | Phase 1 |
| OD7 | Vision model default: Gemini 3 Pro or Claude Opus? | Phase 1 |
| OD8 | Embedding stack: Voyage + OpenAI hybrid, or single provider? | Phase 0 |
| OD9 | Image gen for diagrams: Imagen, Flux, or self-hosted? | Phase 4 |
| OD10 | On-prem model: Llama 4, DeepSeek, Qwen — which family? | Phase 8 |
| OD11 | Code interpreter sandbox: E2B, Modal, or Daytona? | Phase 2 |
| OD12 | Cost SLO: $X/active-project/month numeric target? | Phase 8 (Phase 0 if budget caps are tight) |
| OD12a | On-prem GPU sizing (A100 / H100 / consumer) | Phase 8 |

---

# Document History

- **v4 · 2026-05-20** — Memory & Learning robustness pass (per [MEMORY_AND_LEARNING_REVIEW.md](./MEMORY_AND_LEARNING_REVIEW.md)):
  - **Phase 0 schema:** bi-temporal fields on MemoryItem (`valid_at`, `invalid_at`, `ingested_at`); `embedding_model_version`; `claim_modality`; `derivation_depth`; `idempotency_key`; `quarantined`; `canonical_form`; `provenance_cluster_id`. New `Decision` table (separate from Prediction). New `source_trust_register`. Unique constraint + idempotent contradiction linking.
  - **Phase 1 extraction (Workstream 1.4):** unified ADD/UPDATE/SUPERSEDE/NOOP decision; canonical proposition normalization (S-P-O-qualifier); multilingual embedding for dedup; structured numeric claim schema; source-trust register + quarantine tier; Bayesian confidence aggregation over distinct provenance clusters; subsumption + scope + modality checks at write; idempotency keys; resurrect-on-match decay; **reflection cron (Generative Agents pattern)** — the mechanism by which memory promotes Session → Project → Company.
  - **Phase 1 retrieval (Workstream 1.3):** RRF fusion (k=60 fixed); cross-encoder reranking; MMR for diversity; bi-temporal query clamp; visibility filter at query time.
  - **Phase 2 retrieval (new Workstream 2.7):** query classifier (lookup vs multi-hop); HippoRAG-style Personalized PageRank for multi-hop queries. Old 2.7 (Share-and-Apply) renumbered to 2.8.
  - **Phase 6 calibration (Workstream 6.1):** Brier + resolution scoring; stratified by horizon/dimension/source-trust; open-stale dashboard; intervention vs counterfactual cohorts; rolling-window; Bayesian priors for sparse classes; decision evaluation track separate from prediction calibration.
  - **Phase 6 playbook engine (Workstream 6.3):** Voyager-style outcome-gated promotion; diversity requirement; stale playbook retirement; automatic curriculum.
  - **Phase 6 audit (Workstream 6.5):** Constitution-based audit; priority-sampled by confidence × decay-class.
  - **Phase 6 (new Workstream 6.6):** causal attribution with hand-curated industry confounder DAGs; pattern-level calibration; no-success-only training rule.
- **v3 · 2026-05-20** — Added Share-and-Apply (H13) capability across phases:
  - Phase 1 · Workstream 1.8 — Strategy Artifact Recognition (ingest classifies + structures external strategy artifacts)
  - Phase 2 · Workstream 2.7 — Fit Assessment + Adaptation agents + portfolio scan mode + application memo
  - Phase 3 · Workstream 3.5 — Micro war-game deep-mode option for applied strategies
  - Phase 4 · Workstream 4.3 — Voice triggers ("Apply this to TestCo", brainstorm mode integration)
  - Phase 7 · Workstream 7.5 — Applied Strategy Library (cross-portco calibrated view)
  - Plus acceptance-gate updates in Phase 2 to verify Share-and-Apply works end-to-end
  - Phase 7 workstream renumbered to 7.6 for Voice Briefing
- **v2 · 2026-05-20** — Applied 24 fixes across 3 review passes:
  - Added `Company`, `StrategyProject`, `Session`, `Outcome`, `Contradiction` tables to Phase 0
  - Moved `code_interpreter` to Phase 2 with sandbox decision (OD11)
  - Clarified LLM router scope (text/embed only); realtime voice as separate abstraction in Phase 4
  - Added usage event log to Phase 0 for objective phase-gate verification
  - Defined "defensible alpha", "hot path", "closed prediction", "real usage"
  - Added cross-cutting briefing-default output policy + two-tier UX policy
  - Added decay / consolidation / dedup crons to Phase 1
  - Added portco onboarding workflow to Phase 1
  - Added user memory + global memory layers to Phase 1
  - Added contradiction review UI to Phase 2
  - Sequenced Phase 5 connectors (Linear first, others incremental)
  - Sequenced Phase 5 KPI sources (Stripe first)
  - Added TTS war-game playback to Phase 3
  - Added memo dictation surface to Phase 4
  - Added voice briefing (daily/weekly) to Phase 7
  - Added portfolio investment thesis editor to Phase 7
  - Seeded short-horizon predictions in Phase 3 (war-game outcomes) to feed Phase 6 calibration
  - Added prerequisite portco-count check before Phase 7
  - Added synthetic drift test fixture to Phase 5
  - Added Phase 8 numeric cost SLO (OD12)
  - Documented within-phase sequencing for Phases 0, 2, 5
  - Added OD3a (vault), OD11 (sandbox), OD12 (cost SLO), OD12a (GPU)
  - Added explicit "real usage" telemetry requirement to acceptance gates
- **v1 · 2026-05-20** — Initial draft, Phase 0-8 detailed, acceptance gates and risks per phase, cross-cutting workstreams.

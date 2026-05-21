# MASTER.md — Strategy Platform Source of Truth

> The single canonical "where are we?" document. Updated **in the same PR** as any major change (per the named-file rule in [CLAUDE.md](./CLAUDE.md)).
>
> If this doc is more than 14 days stale at the time of a major shipping change, treat that as a bug and fix it.

---

## Header Metadata

| | |
|---|---|
| **Generated / Last Major Update** | 2026-05-21 (Phase 1 complete) |
| **Version** | v0.2.0 (Phase 1 complete — memory engine end-to-end) |
| **Current Phase** | Phase 1 ✅ complete — Phase 2 (Diagnosis + Research Mesh) is next |
| **Deployment URL** | Manus-hosted (see project settings for live URL) |
| **Repository** | [paigautham-hue/strategy-platform](https://github.com/paigautham-hue/strategy-platform) (private) |
| **Branch** | `main` |
| **Last commit at update time** | Phase 1 — user/global memory layers (Workstream 1.7) |
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
| **1** | Memory, Ingest, Voice Intake, Hygiene Crons | ✅ | 2026-05-21 | 2026-05-21 | ✅ | All 8 workstreams shipped — see Recent Changes |
| **2** | Diagnosis + Research Mesh + Code Interpreter | 🟡 | 2026-05-21 | — | — | Diagnosis Agent (2.2) shipped; orchestrator + research agents next |
| **3** | Reasoning Mesh + Simulation + Cross-Co War-Game | 🟡 | 2026-05-21 | — | — | All 6 workstreams shipped (3.1 Frameworks → 3.6 Cross-Co War-Game); gate pending TTS playback (infra-gated) + 4-week usage telemetry |
| **4** | Brainstorm Mode + Multimodal + Realtime Voice + Distill | 🟡 | 2026-05-21 | — | — | 4.2 Brainstorm, 4.4 Personas, 4.5 Memo Dictation shipped; 4.1 realtime voice / 4.3 voice triggers / diagram gen / 4.6 distillation infra-gated |
| **5** | Strategy → Execution + Operator UX Tier | 🟡 | 2026-05-21 | — | — | 5.1 Decomposer + Pre-Mortem, 5.4 Drift Detection shipped; 5.2 connectors / 5.3 KPI sync / 5.5 Slack bot infra-gated |
| **6** | Learning Loop Activates | 🟡 | 2026-05-21 | — | — | 6.1–6.5 shipped (Calibration, Pattern Mining, Playbooks, Attribution, Constitutional Audit); resolver cron + 6.6 DAGs need closed-prediction data |
| **7** | Portfolio + Synergy + Voice Briefing | 🟡 | 2026-05-21 | — | — | 7.1 Synergy Scout shipped; 7.3 dashboard / 7.5 applied library / 7.6 TTS briefing need portfolio data |
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
| Universal ingest | 1 | 🟡 | text / markdown / html / URL / **PDF / DOCX** live; audio / video / image pending |
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

### 2026-05-21 · Phase 7 — Synergy Scout (Workstream 7.1)
- **`server/agents/synergy-scout.ts`** — nine detectors (capability, customer, supplier, channel, geographic, talent, tech/IP, capital-structure, macro-exposure overlap) scan 2-6 portfolio companies for concrete, capturable synergy candidates. Each candidate carries the detector, the companies it spans, a value (low/medium/high), a confidence, and a recommended action. `normalizeSynergyResult` resolves company names to IDs and sorts candidates by value then confidence.
- **Three-layer enforcement** (like the cross-company war-game): `gpProcedure`, per-company tenant validation, GP-only `/synergy` route. Every cross-company memory read is audit-logged at restricted tier. Each company's memory search is namespaced to that single company (C1).
- **tRPC** `synergy.scout` + **UI** `/synergy` page (multi-company picker, value-sorted candidates with detector, companies, confidence, action).
- **Tests**: +6 unit tests (detector registry, name→id resolution, unknown-detector filtering, value sort, value/confidence defaulting). 398 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 6 — Pattern Mining (Workstream 6.2)
- **`server/agents/pattern-mining.ts`** — across a set of past projects, `minePatterns` finds the recurring **decision structures** (name, when it applies, typical outcome, support count) and an anti-pattern detector flags the repeated **failure shapes** (failure mode, support). Only genuinely recurring shapes are reported — a one-off is not a pattern. A mined pattern that recurs is a candidate for the playbook engine (6.3).
- **tRPC** `pattern.mine` (requires ≥ 2 projects) + **UI** `/patterns` page (dynamic project list with add/remove, recurring patterns and anti-patterns with support counts).
- **Tests**: +4 unit tests (mining normalization, name/description filtering, support clamping, non-object payload). 392 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 6 — Playbook Engine (Workstream 6.3)
- **`server/agents/playbook.ts`** — a playbook is a reusable strategic skill: trigger conditions, gated steps, expected outcomes. `draftPlaybook` auto-drafts one from a recurring pattern. Playbooks are promoted project → company → portfolio through **pure, tested gates** (Voyager-style outcome-gated skill verification): `meetsOutcomeGate` (≥ 3 evidence projects at ≥ 50% hit rate, M3/T11), `meetsDiversityRequirement` (Portfolio promotion needs evidence spanning ≥ 2 industries / geos / stages, M1 — no promotion on portco-idiosyncratic luck), `checkPromotion` (combines them per target layer), and `shouldRetire` (stale retirement below a 30% hit rate after 6 months, M2).
- **tRPC** `playbook.draft` + `playbook.checkPromotion` + **UI** `/playbooks` page (draft a playbook from a pattern; promotion-ladder explainer).
- **Tests**: +14 unit tests (draft normalization, diversity/outcome gates, promotion ladder, stale retirement). 388 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 6 — Anti-Hallucination Audit (Workstream 6.5)
- **`server/services/audit-constitution.ts`** — a constitution-based audit that measures principle-*compliance*, not vibes. Four explicit, checkable principles (numeric claims cite a source; predictions specify horizon + confidence; causal claims name confounders; cross-portfolio analogies name both sides) applied to ledger claims via **pure, deterministic heuristics**: `hasNumericClaim` (ignores bare years), `citesSource`, `hasCausalLanguage`, `namesConfounder`. `checkPrediction` returns compliant / violation / not-applicable per principle; `auditPredictions` aggregates a `ComplianceReport` with per-principle compliance rates and flagged claims.
- **tRPC** `compliance.auditPredictions` + **UI** `/compliance` page (overall compliance %, per-principle bars, flagged claims with the principles they breach).
- **Tests**: +14 unit tests (each detector, per-principle checks, applicability, report aggregation, empty/clean samples). 376 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 6 — Causal-Lite Attribution (Workstream 6.4 / 6.6)
- **`server/agents/attribution.ts`** — when an initiative completes, attributes the outcome: did the initiative cause it, or would it have happened anyway? Names the variables the team changed, sketches a plausible counterfactual, splits credit between internal and external factors, and **names the confounders any causal claim must be conditioned on** (L1/L3 — never asserts causation without them). Auto-drafts a post-mortem framed as **hypotheses** (operator confirms before it lands in memory). `hasFailureTrace` is derived — a post-mortem with no "what didn't" is itself flagged (anti-pattern AP6 / L4).
- **tRPC** `attribution.analyze` + **UI** `/attribution` page (what worked / what didn't, variables changed, counterfactual, credit assignment with internal/external tags, confounders, the extracted lesson).
- **Tests**: +6 unit tests (attribution normalization, failure-trace flagging, contribution/isInternal defaulting, credit-factor filtering). 365 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 6 — Calibration Scoring Library (Workstream 6.1)
- **`server/services/calibration.ts`** — proper scoring rules so confident hedging cannot game the learning loop. `brierScore` / `meanBrier`; `brierDecomposition` (Murphy: Brier = reliability − resolution + uncertainty — resolution *rewards* forecasts that separate outcomes from the base rate, penalising uninformative hedging, the J3 Goodhart trap); `calibrationCurve` (predicted vs. observed frequency, binned); `meanSquaredError` / `mape` for point predictions; `hitRate`.
- **`computeScorecard`** — a stratified scorecard that scores **real and synthetic outcomes separately (J4)** — war-game closes never contaminate the real-world record — and splits real calibration by framework and horizon. `deriveOutcome` recovers the binary outcome from a closed prediction's `errorDelta`; `getCalibrationRecords` joins the prediction ledger to its outcomes (returns [] with no DB).
- **tRPC** `calibration.scorecard` + **UI** `/calibration` page (real vs. synthetic strata, per-framework / per-horizon breakdown, calibration curve; empty-state until predictions close).
- **Tests**: +16 unit tests (Brier, Murphy decomposition + identity, calibration curve, MSE/MAPE, scorecard real/synthetic separation, outcome derivation). 360 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 5 — Drift Detection + Replan Engine (Workstream 5.4)
- **`server/agents/drift.ts`** — three pure, deterministic detectors watch an active initiative: `scheduleDrift` (actual vs. planned progress → ahead/on-track/slipping/behind), `kpiDrift` (a leading indicator vs. expected, gated on a minimum sample size so noise never trips an alert; favourable divergence is not drift), `thesisDrift` (contradiction count vs. threshold → stable/questioned/invalidated). `detectDrift` + `overallSeverity` roll them up to none/watch/alert; `needsReplan` is the gate.
- **Replan engine** — when drift is found, `proposeReplan` recommends exactly one of Continue / Adjust-pace / Pivot / Kill with a rationale and concrete adjustments. The three detectors are the place a synthetic drift fixture is exercised end to end (Phase 5 deliverable).
- **tRPC** `drift.detect` (runs detectors, proposes a replan only when warranted) + **UI** `/drift` page (per-detector status, severity roll-up, replan proposal).
- **Tests**: +14 unit tests (each detector's bands, sample gating, favourable-direction logic, severity roll-up, replan normalization). 348 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 5 — Pre-Mortem Launch Ritual (Workstream 5.1)
- **`server/agents/pre-mortem.ts`** — before an initiative goes "active", run a pre-mortem: assume it is twelve months later and the initiative failed outright, then work backwards. Produces a risk register, each risk graded for likelihood × impact with an early-warning sign and a mitigation. Pure `riskSeverity` (likelihood × impact → low/medium/high/critical) and `normalizePreMortem` (sorts most-severe first; `readyToLaunch` is true only when risks were surfaced and every one carries a mitigation — the launch gate is deterministic).
- **tRPC** `decomposer.preMortem` + **UI** `/pre-mortem` page (cleared-for-launch banner, top risk, severity-sorted risk register).
- **Tests**: +10 unit tests (severity bands, normalization, severity sort, launch-gate logic, grade defaulting). 334 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 5 — Strategy Decomposer (Workstream 5.1)
- **`server/agents/decomposer.ts`** — the Strategy → Execution bridge. Decomposes a strategy thesis into 3-5 initiatives, each carrying a rationale, expected impact, cost estimate, confidence (0-1), dependencies, OKRs (objective + leading/lagging key results), and a task list. Grounded in company memory.
- **Decomposer challenger** — `flagVagueObjectives` deterministically flags every objective whose key results are all unmeasurable; `isQuantitative` tests a KR for a number / percentage / currency amount. Vague OKRs never pass silently (Phase 5 risk mitigation) — the verdict is a pure function, not left to the model.
- **tRPC** `decomposer.decompose` + **UI** `/decompose` page (initiatives with OKRs, leading/lagging + not-measurable badges, tasks, dependencies, a vague-objective warning banner).
- **Tests**: +11 unit tests (quantitative detection, vague-objective challenger, decomposition normalization, confidence clamping). 328 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 4 — Advisory Personas (Workstream 4.4)
- **`server/agents/personas.ts`** — a registry of five advisory stances (The Coach, The Challenger, The Devil's Advocate, The Consultant, The Chief of Staff), each with a stance prompt. `consultPersona` answers a question grounded in company memory, in that persona's voice. Pure helpers `getPersona` (defaults to Coach), `listPersonas` (picker view — stance prompt never leaves the server), `normalizeConsult` (caps key points at 6).
- **tRPC** `persona.list` + `persona.consult`. **UI** `/personas` page — persona picker, question box, response with key points.
- **Scope note**: the realtime mid-flight persona *swap* ("let me hear from the regulator") stays infra-gated with the realtime voice channel — this is the text-based consult.
- **Tests**: +7 unit tests (registry shape, persona resolution, picker view excludes stance, consult normalization). 320 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 4 — Memo Dictation (Workstream 4.5)
- **`server/agents/memo-dictation.ts`** — turns a raw dictated monologue into a clean one-page strategy memo: title, executive summary, a few labelled sections, decisions, and next actions. Briefing-default (H6) — structure first, transcript second; faithful to what was said (no invented facts). On failure it preserves the raw transcript so nothing is lost. Pure `normalizeMemo` (drops empty sections, caps sections at 8 / lists at 10) and `renderMemoMarkdown` are tested.
- **tRPC** `memo.structure` + **UI** `/memo` page — dictate or type, structure into a memo, copy as markdown.
- **Tests**: +6 unit tests (memo normalization, section/list caps, markdown rendering). 314 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 4 — Brainstorm Mode (Workstream 4.2)
- **`server/agents/brainstorm.ts`** — a structured brainstorm runs four phases (Diverge → Probe → Sharpen → Lock), each with its own facilitation stance. Five **silent extractors** capture the raw material in one structured call — hypotheses, options, assumptions, risks, open questions — and a recap call names recurring themes, unresolved threads, and suggested next moves. Pure, tested: `nextPhase`, `getPhase`, `normalizeCaptures` (dedup + per-category cap of 15), `captureCount`, `normalizeRecap`.
- **tRPC** `brainstorm.extract` + `brainstorm.recap`. **UI** `/brainstorm` page — phase stepper, transcript box with browser voice **dictation** (reuses the Workstream 1.5 one-shot speech path), a five-category draft tray, and a recap card with suggested moves.
- **Scope note**: this is the brainstorm *intelligence* — it runs on typed or dictated text. The realtime WebRTC voice *channel* (4.1), diagram generation (4.5, OD9), and hot-path distillation (4.6, OD10) remain infra-gated.
- **Tests**: +10 unit tests (phase machine, capture/recap normalization, dedup, caps). 308 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 3 — Cross-Company War-Game (Workstream 3.6)
- **`server/agents/cross-co-war-game.ts`** — applies one shared shock (FX swing, supplier acquisition, new regulation) across 2-6 portfolio companies at once and surfaces the non-obvious cross-company synergies and correlated risks. Each company's context is gathered with a memory search **namespaced to that single company** — the agent never issues a cross-company query (C1). Pure `normalizeCrossCoResult` resolves model-returned company names back to IDs (case-insensitive / partial), dedupes outcomes, defaults exposure/kind.
- **Three-layer enforcement** of the deliberate cross-company boundary cross: layer 1 (API) `gpProcedure`; layer 2 (query) every `companyId` validated against the tenant via `getCompany`; layer 3 (UI) `/cross-war-game` is GP-only in nav. **Every cross-company read is audit-logged** at restricted tier via the new `auditCrossCompanyRead` wrapper. Per-company synthetic outcomes recorded to the ledger (`framework: "cross_co_war_game"`).
- **tRPC** `warGame.crossCompany` + **UI** `/cross-war-game` page (multi-company picker, scenario, portfolio implication, per-company exposure, synergy/risk findings).
- **Tests**: +7 unit tests (name→id resolution, partial match, exposure/kind defaulting, dedup, findings cap). 298 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 3 — Share-and-Apply Micro War-Game (Workstream 3.5)
- **`server/agents/apply-war-game.ts`** — "deep mode" for the Share-and-Apply pipeline (H13). After an external strategy artifact is adapted to a company, deep mode plays the **adapted moves** out as a quick 2-round micro war-game, then runs a comparison call that judges the simulated outcome against the artifact's stated expected outcomes (`aligned` / `partial` / `diverges`) and revises the recommendation. Pure helpers `buildAppliedStrategyText` (prefers adapted moves, falls back to artifact key moves) and `normalizeComparison` are fully tested.
- **tRPC** `strategyArtifact.applyToCompany` gains an optional `deepMode` flag — when set (and the input is a real artifact) it returns a `deepMode` block and records the micro war-game outcome to the ledger as **synthetic** (`framework: "apply_war_game"`, `outcomeClass: "synthetic"`). **UI** `/strategy-artifacts` page adds a deep-mode toggle and a "Simulated outcome vs expected" result card.
- **Tests**: +7 unit tests (applied-strategy text construction, fallback, comparison normalization/alignment defaulting). 291 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 3 — War-Game Simulation (Workstream 3.4)
- **`server/agents/war-game.ts`** — plays a strategy out over several rounds (default 3, max 5) against 4 reacting stakeholders across 4 arenas: Customer Archetype (customer), Competitor CEO (competitor), Regulator (regulatory), Activist Investor (capital). Round 1 reacts to the strategy; later rounds react to and escalate the prior round's moves. A separate adjudication call judges whether the strategy `survived` and extracts key learnings. Best-effort per round (a failed round yields no moves but the game continues); grounded in company memory via hybrid search.
- **tRPC** `warGame.run` — runs the simulation then records the outcome to the prediction ledger as a **synthetic** outcome (`outcomeClass: "synthetic"`, `framework: "war_game"`) so the calibration loop never mixes war-game results with real outcomes (J4). **UI** `/war-game` page (survived/outcome banner, key learnings, per-round stakeholder moves).
- **Tests**: +9 unit tests (round normalization, stakeholder defaulting, outcome normalization, learnings cap). 284 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 3 — Red-Team Critic (Workstream 3.3)
- **`server/agents/red-team.ts`** — adversarial review of a strategy from 5 hostile personas (The Contrarian, The Regulator, The Incumbent Competitor, The Skeptical Investor, The Execution Skeptic). Each critique graded fatal / major / minor; `survivedReview` is derived deterministically — a strategy with any fatal flaw has NOT survived (the verdict is never left to the model).
- **tRPC** `redTeam.review` + **UI** `/red-team` page (verdict banner, per-persona critiques with severity).
- **Tests**: +8 unit tests (survived-review logic, severity/persona defaulting, fatal-flaw extraction). 275 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 3 — Option Generator + MCDA (Workstream 3.2)
- **`server/agents/options.ts`** — generates 4-8 distinct strategic options for a question and scores each on 8 MCDA criteria (strategic fit, market, capability, financial, execution safety, speed, reversibility, synergy — weights sum to 1). The LLM produces options + raw 0-10 scores; **weighting, ranking, and ±20% sensitivity analysis are pure, fully-tested functions** — `computeWeightedScore`, `isRankingRobust`.
- **tRPC** `options.analyze` + **UI** `/options` page (ranked options with MCDA score, per-criterion breakdown, robustness flag).
- **Tests**: +13 unit tests (criteria weights, score clamping, weighted-score math, ranking robustness, normalisation). 267 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 3 begins — framework library (Workstream 3.1)
- **`server/agents/frameworks.ts`** — 8 strategy frameworks as structured agents: Porter Five Forces, Ansoff Matrix, JTBD, Wardley Map, Three Horizons, BCG Matrix, Blue Ocean (Four Actions), Christensen Disruption Lens. Frameworks are NOT a user menu (P4) — `frameworksForQuestionType` selects them from the diagnosed question type. `runFrameworks` applies the selected set in parallel, grounded in company memory; uniform section/summary/implications output.
- **tRPC** `frameworks.analyze` (diagnose → select → apply) + **UI** `/frameworks` page.
- **Tests**: +10 unit tests (registry, question-type selection, analysis normalisation). 254 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 2 — Contradiction Review (Workstream 2.6)
- **`server/services/contradictions.ts`** — `listContradictions()` (joined with both memory items for review) + `resolveContradiction()`: in-favor-of-A retires B, in-favor-of-B retires A (supersede, never delete — C19), both-valid-with-scope keeps both. Transactional; company-scoped (C1); audit-logged.
- **tRPC** `contradiction.list` / `contradiction.resolve` + **UI** `/contradictions` — side-by-side claim comparison with confidence, three resolution actions, resolved-history view.
- **Tests**: +7 unit tests (resolution → retired-item / winner mapping). 244 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 2 — Share-and-Apply engine (Workstream 2.8, H13)
- **`server/agents/apply-strategy.ts`** — `applyStrategyToCompany()`: takes a recognised StrategyArtifact and applies it to a portfolio company — fit score (0-100) + rationale, gap list, each key move adapted to the company's context, risks, a recommendation (pursue / adapt-heavily / skip), and a one-page application memo. Grounded in company memory; honest about poor fit. Defensive parse.
- **tRPC** `strategyArtifact.applyToCompany` (recognise → apply in one call) + **UI** — the Strategy Artifacts page gained a "Recognise & apply to company" action showing fit score, adapted moves, risks, and the memo.
- **Tests**: +7 unit tests (application normalisation — score clamping, adapted-move resolution, list caps). 237 pass / 16 skipped / 0 fail; typecheck + build clean.
- Note: tRPC reserves `apply` as a procedure name — the procedure is `applyToCompany`.

### 2026-05-21 · Phase 2 — Chief Strategist + research mesh (Workstreams 2.1 + 2.3)
- **`server/agents/research.ts`** — 8 specialist research agents (market, competitor, customer, tech, regulatory, macro, talent, internal-data). `runResearchMesh()` selects the specialists relevant to the diagnosed question type, grounds them in the company's memory (one hybrid-search pass shared across agents), runs them in parallel (H4), and the Chief Strategist synthesises their findings into a research brief with key takeaways.
- **tRPC** `research.run` — diagnoses the question (P4) then dispatches the mesh — and **UI** `/research` (question → diagnosis + per-specialist findings + synthesis).
- **Tests**: +6 unit tests (specialist selection by question type). 230 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 2 begins — Diagnosis Agent (Workstream 2.2)
- **`server/agents/diagnosis.ts`** — `diagnoseQuestion()`: the entry point of the reasoning mesh (P4 — diagnosis precedes frameworks). Challenges the user's framing, re-states the real strategic question, classifies its type (10-type taxonomy: adjacency / white-space / geographic / M&A / pricing / capability / competitive-response / portfolio / scenario / custom), surfaces the genuine unknowns, and suggests frameworks. Defensive parse; best-effort fallback to the original question.
- **tRPC** `diagnosis.diagnose` + **UI** `/diagnose` page (question → reframed question, type, key unknowns, suggested frameworks, rationale, confidence).
- **Tests**: +8 unit tests. 224 pass / 16 skipped / 0 fail; typecheck + build clean.

### 2026-05-21 · Phase 1 COMPLETE — user / global memory layers (Workstream 1.7)
- **`server/services/memory-layers.ts`** — the two non-company-scoped layers: GLOBAL (framework canon, durable industry knowledge, shared tenant-wide) and USER (the GP's preference / decision-style overlay). Implemented without a migration via reserved per-tenant Company containers (`__global__`, `__user__`), created lazily and hidden from the company switcher (`listCompanies` filters `__…__` names). `getLayeredContext()` does layer-routed retrieval — company + global + user merged.
- **tRPC** `memory.writeLayer` / `memory.queryLayer`.
- **Tests**: +4 unit tests. 216 pass / 16 skipped / 0 fail; typecheck + build clean.
- **Phase 1 is functionally complete.** All eight workstreams shipped. (Audio/video/image ingest parsers reclassified to Phase 4 multimodal; near-duplicate semantic consolidation deliberately deferred — both noted in the backlog.)

### 2026-05-21 · Phase 1 — voice intake (Workstream 1.5)
- **`client/src/lib/speech.ts`** — browser Web Speech API wrapper for one-shot dictation (client-side STT, no audio upload, no server transcription call); graceful text-input fallback where unsupported.
- **`server/services/voice-intent.ts`** — `parseVoiceIntent()`: a spoken request → structured strategy-project intent (name, description, summary, confidence). Defensive parse; falls back to the transcript so a project is always creatable.
- **tRPC** `voice.parseIntent` + **UI** `/voice-intake` — dictate → parse → editable project draft → create.
- **Tests**: +8 unit tests (voice-intent normalisation). 212 pass / 16 skipped / 0 fail; typecheck + build clean.
- (Realtime WebRTC always-on voice copilot is Phase 4; this is the Phase 1 one-shot path.)

### 2026-05-21 · Phase 1 — PDF / DOCX ingest (Workstream 1.2)
- **`client/src/lib/file-extract.ts`** — `extractTextFromFile()`: in-browser PDF (pdfjs-dist) and DOCX (mammoth) text extraction, plus plain text/markdown. Heavy parsers dynamically imported — code-split, not in the main bundle.
- **Ingest page** — "Upload PDF / DOCX / text" button; the extracted text flows through the existing ingest pipeline (no server binary handling, no storage upload, no migration).
- 204 tests / 16 skipped; typecheck + build clean (parsers confirmed code-split).

### 2026-05-21 · Phase 1 — memory reflection cron (Workstream 1.4 / T5)
- **`server/cron/memory-reflection.ts`** — `runMemoryReflection()`: nightly, per company, synthesises recent ground-level (derivationDepth 0) memory into 3-5 higher-level strategic insights via the LLM, written back as `derivationDepth 1` memory items (`framework: reflection`, confidence capped at 0.55 — an insight is a hypothesis). Recursion is bounded by depth — reflections are never reflected upon (C4). Generative-Agents pattern (T5) — the compounding-intelligence mechanism.
- Wired into the nightly cron alongside hygiene (`runNightlyTelemetry`).
- **Tests**: +7 unit tests (reflection output normalisation). 204 pass / 16 skipped / 0 fail; typecheck + build clean.
- Memory hygiene now covers decay + exact-dedup + reflection; near-duplicate *consolidation* (semantic merge) intentionally deferred — it needs a higher bar / human review.

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

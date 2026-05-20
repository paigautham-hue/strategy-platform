# Memory & Learning Systems — Robustness Review

> Stress-test of the agentic memory and self-learning subsystems against ~50 edge cases, supplemented by external research into 2024–2026 AI expert work (Mem0, Letta, Cognee, Graphiti, A-MEM, HippoRAG, MemoRAG, Voyager, Generative Agents, Reflexion, DSPy, TextGrad, Constitutional AI, GraphRAG, HippoRAG 2, PathRAG, LightRAG).
>
> Companion to [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) and [GUIDING_PRINCIPLES.md](./GUIDING_PRINCIPLES.md).
> Findings here drove targeted edits to [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) (Phase 0/1/2/6 additions) and [CLAUDE.md](./CLAUDE.md) (Critical Patterns C19-C25).

---

## Executive Summary

The memory and learning subsystems are the platform's moat. They were designed at the principles level (six layers, three types, dimensional tags, hybrid retrieval, prediction ledger, calibration cron, pattern mining). The stress-test surfaces:

- **14 critical gaps** that would corrupt the moat over 6-18 months if shipped as-is
- **13 important strengthenings** that improve robustness but aren't existential
- **12 high-ROI techniques** from external work that we should adopt outright
- **9 anti-patterns** the field has surfaced that we should explicitly refuse

The most consequential single change: **adopt Graphiti-style bi-temporal edges with explicit `valid_at` / `invalid_at` / `ingested_at` everywhere — never delete, only invalidate.** This one decision propagates into 30% of the other fixes.

The second-most: **unify extract → dedup → contradict → store into a single LLM decision returning ADD / UPDATE / SUPERSEDE / NOOP** (Mem0 pattern). Splitting these into three passes risks them disagreeing.

The third: **canonical-form normalization of every proposition before embedding** (rewrite to S-P-O-qualifier). Makes paraphrase + cross-lingual dedup tractable; makes hierarchical claims comparable.

---

# PART 1 · Memory System — Issue Inventory

Status legend: ✅ covered · 🟡 partially covered (needs strengthening) · ❌ gap (must add)

## A. Duplicate Detection

| # | Issue | Status | Severity | Recommended fix |
|---|---|---|---|---|
| A1 | Exact text duplicates from same source | ✅ | — | dedup cron handles |
| A2 | Near-duplicates (paraphrased) from same source | 🟡 | High | Embed *normalized* proposition (S-P-O-qualifier), cluster at cosine ≥ 0.92, then LLM-judge equivalence (Mem0 pattern). Don't rely on raw-text similarity. |
| A3 | Same fact, multiple sources — legitimate corroboration | 🟡 | High | Reinforcement must be source-diversity-weighted, not mention-counted. `confidence = 1 - Π(1 - r_i)` over **distinct** sources `i`. |
| A4 | Cross-lingual duplicates (PT-BR ↔ EN) | ❌ | High | Use multilingual embedding model (BGE-M3 or multilingual-e5) for the dedup pass even if downstream is English-only. Do not translate-then-embed. |
| A5 | Numeric claims with different precision / units / periods | ❌ | High | Extract numeric claims to typed schema `{value, unit, period, basis}`. Normalize unit (pint-equivalent) and period (Q→annualized) **before** dedup. |
| A6 | Same claim, different temporal scopes stated | ❌ | Medium | Numeric schema (A5) captures `period`. For non-numeric: temporal scope = explicit dimension tag. |
| A7 | Hierarchical claims — general ("SaaS has high CAC") vs specific ("Co A has high CAC") | ❌ | Medium | Four-way subsumption check at write time: `entails / entailed-by / equivalent / contradicts / independent`. Both general and specific coexist; reinforce both when matched. |

## B. Contradictions

| # | Issue | Status | Severity | Recommended fix |
|---|---|---|---|---|
| B1 | True contradiction (same temporal slice, same scope) | ✅ | — | Contradiction edge + 4-state resolution UI already in plan |
| B2 | Temporal supersession ("Series B" 2024 → "Series C" 2026) | 🟡 | High | **Not a contradiction.** New edge added with `valid_at=now`; old edge gets `invalid_at=now`. Both queryable forever. Graphiti pattern. |
| B3 | Scope-specific apparent contradictions ("enterprise CAC $1500" vs "SMB CAC $400") | 🟡 | High | Contradiction detection must consider dimensional tags before flagging. If `segment` differs and both are specific, **not a contradiction.** |
| B4 | Confidence-asymmetric conflicts (high-conf source vs low-conf source) | 🟡 | Medium | Auto-resolve only when confidence delta > 0.4 AND sources independent. Otherwise human review. |
| B5 | Counterfactual claims ("if X then Y") vs actual claims ("X happened → Z") | ❌ | High | Tag `claim_modality: actual / hypothetical / simulated / counterfactual`. Different modalities never contradict. |

## C. Confidence & Provenance

| # | Issue | Status | Severity | Recommended fix |
|---|---|---|---|---|
| C1 | Source-diversity weighting (5 quotes of same article ≠ 5 sources) | ❌ | Critical | Cluster provenance by publisher / domain / author. Bayesian aggregation over distinct clusters only. |
| C2 | Source-credibility scoring (SEC filing > random blog) | ❌ | High | Source reputation register: per-domain trust prior. New sources start at 0.5; verified climbs over time. |
| C3 | Confidence calibration drift (systematic over/under) | ✅ | — | Calibration cron in Phase 6 covers this — but ensure it stratifies by source type (see J5). |
| C4 | Derivation-depth confidence inflation (agent-of-agent-of-agent) | ❌ | High | Track `derivation_depth` on each claim. Cap confidence by depth: `max_confidence = 0.95 ^ depth`. |
| C5 | Adversarial / poisoned inputs (manipulated competitor docs) | 🟡 | Critical | **Quarantine tier**: new facts below trust threshold are stored but NOT retrievable in Portfolio/Global layers until corroborated by ≥ 2 independent sources OR explicitly approved by GP. |

## D. Decay & Reinforcement

| # | Issue | Status | Severity | Recommended fix |
|---|---|---|---|---|
| D1 | Slow drift / silent obsolescence (market size grows over years) | 🟡 | Medium | Decay class informed not just by dimension but by *claim type* (numeric > structural > regulatory). Numeric claims decay fastest. |
| D2 | Same-source reinforcement creating false confidence | ❌ | Critical | Reinforcement only counts from **distinct provenance clusters** (A3, C1). Same-source second mention → no confidence gain. |
| D3 | Frozen-in-time high-conf items that should be decaying | 🟡 | Medium | Decay runs regardless of reinforcement; reinforcement adds, decay subtracts. Net effect is a steady-state for actively-true facts. |
| D4 | Linear reinforcement scaling (10 mentions → 10× confidence) | ❌ | Medium | Bayesian Beta-Binomial update; reinforcement saturates near upper bound. |
| D5 | Catastrophic forgetting via decay below threshold | ❌ | High | When an incoming fact matches a decayed memory, **resurrect** (reset decay), don't create a new item. |

## E. Embeddings & Retrieval

| # | Issue | Status | Severity | Recommended fix |
|---|---|---|---|---|
| E1 | Embedding model migration (Voyage v3 → v4) orphans old vectors | ❌ | Critical | `embedding_model_version` column on every vector. Dual-write during migration. Backfill in batches. Never silently mix. |
| E2 | Vector index growth at >1M items | ❌ | Medium | Tiered hot/cold storage; sharding by tenant. Phase 8 hardening covers; flag now. |
| E3 | Retrieval mode collapse (top-K all near-duplicates) | ❌ | High | **MMR (Maximal Marginal Relevance)** after rerank, λ≈0.5. Critical for cross-portco diversity. |
| E4 | Reranking absent — initial retrieval coarse | ❌ | High | Cross-encoder rerank (BGE-reranker-v2 / Cohere Rerank-3 / Voyage rerank-2) on top-50 from RRF fusion. |
| E5 | Hybrid fusion weights chosen blindly | 🟡 | Medium | **Reciprocal Rank Fusion** (k=60, standard) over BM25 + dense + graph-PPR. Learn weights only after 1000+ labeled queries. |
| E6 | Multi-hop queries underserved by single-shot vector retrieval | ❌ | High | **Personalized PageRank** over entity graph (HippoRAG). Triggered by a query classifier ("lookup" vs "multi-hop / analogy"). |
| E7 | Hard-negative mining absent | 🟡 | Medium | Log clicks/calibration-misses as hard negatives; quarterly fine-tune a lightweight 2-layer MLP adapter on frozen embeddings. |
| E8 | Cache poisoning on low-confidence items | ❌ | Medium | Cache TTL aligned with confidence (low-conf → short TTL); invalidate cache on contradiction event affecting cached item. |

## F. Temporal Handling

| # | Issue | Status | Severity | Recommended fix |
|---|---|---|---|---|
| F1 | Bitemporal queries ("what did we believe in Q3 2026?") | 🟡 | Critical | Explicit triple: `valid_at` (when true in world) + `invalid_at` (when retracted/superseded) + `ingested_at` (when we learned it). Default retrieval clamps to `valid_at ≤ query_time AND (invalid_at IS NULL OR invalid_at > query_time)`. |
| F2 | Time-decayed retrieval ranking | ✅ | — | Already in hybrid retrieval |
| F3 | Forecasted future claims with target dates | ✅ | — | Prediction ledger handles |

## G. Privacy & Permissions

| # | Issue | Status | Severity | Recommended fix |
|---|---|---|---|---|
| G1 | Visibility re-evaluation on retrieval (portco exits portfolio) | 🟡 | High | Visibility filter applied **at query time** based on current portfolio membership, not at write time. Audit log re-evaluations on every cross-co query. |
| G2 | Hard-delete for "right to be forgotten" | 🟡 | Medium | Explicit hard-delete API with audit log + tombstones (prevent re-insertion of deleted claims). |
| G3 | Cross-tenant leakage at query layer | ✅ | — | Namespacing at all layers (P1, C1) |

## H. Scaling & Performance

| # | Issue | Status | Severity | Recommended fix |
|---|---|---|---|---|
| H1 | Hot retrieval cache stale on contradiction | ❌ | Medium | Cache invalidation on contradiction event; covered above (E8) |
| H2 | Memory bloat over years | 🟡 | Medium | Consolidation + cold-tier archival; Phase 8 |
| H3 | Cron jobs unbounded on growing memory | ✅ | — | Already noted: hard time budget per cron + resume cursor |

## I. Race Conditions

| # | Issue | Status | Severity | Recommended fix |
|---|---|---|---|---|
| I1 | Concurrent contradiction creation (two agents detect simultaneously) | ❌ | Medium | Unique constraint on `(memory_item_a_id, memory_item_b_id)` pair; idempotent `link_contradiction` operation. |
| I2 | Concurrent writes for same fact (two ingest workers process same doc) | ❌ | Medium | Idempotency key on writes: `hash(tenant_id, company_id, source_uri, content_hash)`. Second write returns first's id. |

---

# PART 2 · Self-Learning System — Issue Inventory

## J. Calibration

| # | Issue | Status | Severity | Recommended fix |
|---|---|---|---|---|
| J1 | Survivorship bias (only closed predictions calibrate) | ❌ | Critical | **Stratified calibration by horizon class**; track ratio of closed/orphan per domain. Dashboard flags domains with low closure rate. Include open-but-stale predictions as a metric. |
| J2 | Reverse causality (intervention prevented outcome → forecast looks wrong) | ❌ | Critical | Tag every prediction with `intervention_taken: bool` and link to the action(s). Calibrate two cohorts separately: counterfactual (no intervention) vs intervened. |
| J3 | Goodhart's law on calibration → agents learn to hedge to 0.5 | ❌ | Critical | Score with **Brier + resolution (sharpness)**. Penalize both miscalibration AND uninformativeness. Use proper scoring rules, not accuracy. |
| J4 | Synthetic outcomes (war-game) mixed with real outcomes | ❌ | High | `outcome_class: synthetic / real` on each ledger entry. Calibrate two separate scorecards. |
| J5 | Model snapshot at prediction time | ✅ | — | Ledger has `model` field |
| J6 | Calibration drift over time (environment changes) | ❌ | High | Rolling-window calibration (90d / 365d / all-time); time-decayed weighting on older outcomes. |
| J7 | Compound prediction chains (predictions of predictions) | ❌ | Medium | `derivation_depth` on predictions; depth > 2 flagged as low-trust calibration source. |
| J8 | Sparse high-stakes data (5 acquisitions = thin calibration) | ❌ | High | Bayesian priors with uncertainty bands; aggregate via similarity to other decisions when in-class N < 10. |
| J9 | Probabilistic vs point predictions scored same way | ❌ | High | Two scoring methods: Brier for probabilistic, squared error / MAPE for point estimates. Tracked separately. |
| J10 | Decision vs prediction conflation ("we should X" vs "X will happen") | ❌ | High | Separate `Decision` and `Prediction` tables. Decisions evaluated on outcome + counterfactual judgment; predictions on accuracy. |
| J11 | Recency bias in LLM judges | 🟡 | Medium | Shuffle context order before judging; use position-swap pairwise evaluation. |

## K. Pattern Mining

| # | Issue | Status | Severity | Recommended fix |
|---|---|---|---|---|
| K1 | Pattern over-generalization (N=3 may not generalize) | ✅ | — | Already gated at ≥ 3 evidence; add confidence-interval display so user sees uncertainty |
| K2 | Selection bias (only successes surface) | ✅ | — | Anti-pattern detector + explicit failure library |
| K3 | Pattern triggers — false positive surfacing | ✅ | — | Confidence-weighted surfacing already in plan |

## L. Causal Attribution

| # | Issue | Status | Severity | Recommended fix |
|---|---|---|---|---|
| L1 | Confounded outcomes | 🟡 | High | Document known confounders per market/segment as first-class memories; attribution agent **must** consider them. Even a hand-curated DAG per industry beats unconditional regression. |
| L2 | Hindsight bias in auto-drafted post-mortems | ✅ | — | Frame as hypotheses; operator confirmation required |
| L3 | Cross-portco contamination of attribution | 🟡 | Medium | Track which playbooks/patterns were active when decision made; calibrate at pattern level not portco. |
| L4 | STaR/rationalization on only successes | ❌ | High | **Never train procedural memory only on successes**; this breeds confidently-wrong agents. Always include failure cases with explicit failure-mode labels. |

## M. Playbook Engine

| # | Issue | Status | Severity | Recommended fix |
|---|---|---|---|---|
| M1 | Playbook overfitting to single-portco idiosyncrasies | 🟡 | Medium | Diversity requirement on evidence projects (different industries / geos / stages); explicit `evidence_diversity_score`. |
| M2 | Stale playbooks not retired | ❌ | Medium | Playbook calibration (per-playbook hit rate over time); auto-archive at < 30% hit rate after 6 months. |
| M3 | Playbook surfacing without outcome evidence | 🟡 | Medium | Voyager-style: skill (playbook) only promoted to Company/Portfolio layer after passing an outcome check from the prediction ledger. |

## N. Anti-Hallucination Audit

| # | Issue | Status | Severity | Recommended fix |
|---|---|---|---|---|
| N1 | Audit cron costs | ✅ | — | Sampling 1-5%, budget cap |
| N2 | Audit doesn't catch slow drift | 🟡 | Medium | Priority sampling: high-confidence + high-decay-class items audited more often. |
| N3 | Audit is freeform LLM judging | ❌ | High | **Constitution-based audit** (Constitutional AI pattern): explicit principles ("every numeric claim must cite a source memory; every prediction must specify horizon + confidence; every cross-portco analogy must name both sides"). Audit measures principle-compliance, not vibes. |

---

# PART 3 · Techniques to Adopt (External Research)

Sourced from the external research subagent's report. Each maps to where it lands in our pipeline. Ordered by ROI for our specific stack.

### T1 · Graphiti-style bi-temporal edges everywhere
**Lands in:** Phase 0 memory schema. Every fact/edge has `valid_at`, `invalid_at` (nullable), `ingested_at`. Retraction flips `invalid_at`, never deletes. Default queries clamp to `valid_at ≤ now AND (invalid_at IS NULL OR invalid_at > now)`.
**Why:** Prediction Ledger audit demands "what did we believe at decision time?" — impossible without bitemporal. Fixes F1, B2, G2 in one stroke.
**Source:** getzep/graphiti.

### T2 · Unified ADD / UPDATE / SUPERSEDE / NOOP extraction decision
**Lands in:** Phase 1 extraction worker. One LLM call sees `(new_fact, top-K nearest existing memories)` and returns the action. SUPERSEDE replaces Mem0's UPDATE (preserves history per T1).
**Why:** Three separate passes (extract / dedup / contradict) risk disagreeing. Fixes A2, A3, B1, D5 with one decision step.
**Source:** mem0ai/mem0 (modified — supersede instead of overwrite).

### T3 · Canonical proposition normalization before embedding
**Lands in:** Phase 1 extraction. Every claim normalized to canonical S-P-O-qualifier form via LLM rewrite. Both raw and canonical stored; canonical used for embedding + dedup.
**Why:** Makes paraphrase dedup tractable (A2); enables cross-lingual dedup with multilingual embedder (A4); makes hierarchical subsumption check feasible (A7).
**Source:** Mem0 (light version of this), refined per the research report.

### T4 · Bayesian confidence aggregation over distinct sources
**Lands in:** Phase 1 reinforce operation. Confidence = `1 - Π(1 - r_i)` over **provenance-deduplicated** distinct sources `i`. Per-source reliability `r_i` from source-trust register.
**Why:** Eliminates same-source reinforcement trap (A3, C1, D2, D4) in one move.

### T5 · Reflection cron (Generative Agents pattern)
**Lands in:** Phase 1 consolidation cron + Phase 6 learning loop. Periodic reflection over Session/Project memories: "what are the 3 highest-importance insights?" → those become new higher-importance memories at the Company layer. Recursion depth capped at 3.
**Why:** This is **how the platform actually gets smarter.** Without reflection-and-promotion, memory accumulates volume without insight.
**Source:** Park et al., generative_agents.

### T6 · DSPy + MIPROv2 on extractor and judge prompts
**Lands in:** Phase 4 (joins hot-path distillation). Define metric (extraction F1 against curated gold); use Prediction Ledger as labeled training set; MIPROv2 jointly optimizes instruction + few-shot exemplars. **Time-shifted eval split** (newer portco data than training) — random split overfits to strategy data's temporal drift.
**Why:** Turns the Prediction Ledger into a real optimization signal, not a passive scorecard.
**Source:** stanfordnlp/dspy.

### T7 · Cross-encoder rerank → MMR after RRF fusion
**Lands in:** Phase 1 retrieval pipeline. RRF (k=60 fixed) fuses BM25 + dense + graph-PPR → top-50 → cross-encoder rerank → MMR (λ≈0.5) → top-10.
**Why:** Documented NDCG lifts; MMR essential for cross-portco diversity. Fixes E3, E4, E5.

### T8 · Personalized PageRank for multi-hop queries (HippoRAG)
**Lands in:** Phase 2 retrieval, gated by query classifier. "Lookup" queries take the fast hybrid path; "multi-hop / analogy" queries (most strategy queries) take PPR over entity graph from seed entities found by single-hop ANN.
**Why:** Analogy queries across portcos and capabilities are intrinsically multi-hop; vanilla vector retrieval underperforms.
**Source:** OSU-NLP-Group/HippoRAG and HippoRAG 2.

### T9 · Constitution-based anti-hallucination audit
**Lands in:** Phase 6 audit cron. Explicit principle list ("every numeric claim must cite a source memory; every prediction specifies horizon + confidence; every cross-portco analogy names both sides; every causal claim names plausible confounders"). Audit measures principle compliance.
**Why:** Turns audit from vibes to measurable rule-compliance (N3).
**Source:** Constitutional AI patterns.

### T10 · Stratified calibration + Brier + resolution score
**Lands in:** Phase 6 calibration cron. Stratify by horizon class; compute Brier (calibration error) + resolution (sharpness); also display open-but-stale predictions to surface survivorship bias.
**Why:** Fixes J1 (survivorship), J3 (Goodhart hedge), J9 (probabilistic scoring), J11 (calibration over time).

### T11 · Voyager-style skill library for procedural memory
**Lands in:** Phase 6 Playbook Engine. Each playbook = `(description, steps, success_criteria, evidence_outcomes)`. Promotion to Company/Portfolio layer gated by outcome from Prediction Ledger. Curriculum: agent proposes which playbook gap to fill next, bounded by portfolio relevance.
**Why:** Gives procedural layer evidence-promotion discipline matching semantic layer (M3).
**Source:** MineDojo/Voyager.

### T12 · Source-trust priors + quarantine tier
**Lands in:** Phase 0/1 ingest. Per-source-domain trust prior table (SEC filing 0.9, NYT 0.8, random blog 0.4, anonymous social 0.2). New facts below trust threshold land in quarantine memory tier — stored but NOT retrievable in Portfolio/Global layers until corroborated by ≥ 2 independent sources OR explicitly approved.
**Why:** Memory poisoning containment (C5). The cost of a single malicious doc corrupting cross-portfolio reasoning is high; quarantine is cheap.

---

# PART 4 · Anti-Patterns We Refuse

| # | Anti-pattern | Why we refuse |
|---|---|---|
| AP1 | **Embedding-only retrieval at scale** | Demos fine; collapses on multi-hop and cross-tenant. Always combine with BM25 + graph (T7, T8). |
| AP2 | **LLM-rated importance 1–10 as primary ranking** | Uncalibrated; clusters at 5–7 (Generative Agents authors acknowledge). Use as tiebreaker or coarse bucket only. |
| AP3 | **MemGPT-style hard context-paging as architecture** | Long-context models make this obsolete. The valuable idea was *curation* (T5), not paging. |
| AP4 | **Overwriting on contradiction** (Mem0's default UPDATE) | Destroys ledger audit trail. We SUPERSEDE, never overwrite (T1, T2). |
| AP5 | **Silent embedding model upgrades** | Catastrophic migration bugs. Versioned vectors only (E1). |
| AP6 | **STaR / self-distillation on only successful traces** | Survivorship bias amplifier; breeds confidently wrong agents (L4). |
| AP7 | **Learned RRF weights before having labels** | Overfits to the dev set you've stared at. Fixed weights until ≥ 1000 labeled queries (E5). |
| AP8 | **TextGrad applied to stored memory content** | Use TextGrad on *prompts*, never on facts — applying NL gradients to facts is a memory-poisoning vector. |
| AP9 | **One-call extract + judge** | Conflates failure modes. Two-call (extract → judge, different prompts, ideally different model temps) is meaningfully more robust. |

---

# PART 5 · Refined Memory + Learning Architecture (with all fixes baked in)

```
                         INGEST
                            │
                ┌───────────▼───────────┐
                │ Source-trust prior     │  (T12)
                │ → quarantine if low    │
                └───────────┬───────────┘
                            │
                ┌───────────▼───────────┐
                │ Extract: parse to      │  (T3)
                │ canonical S-P-O-       │
                │ qualifier propositions │
                └───────────┬───────────┘
                            │
                ┌───────────▼───────────┐
                │ Multilingual embed     │  (A4)
                │ + structured numeric   │  (A5)
                │ + version tag          │  (E1)
                └───────────┬───────────┘
                            │
                ┌───────────▼───────────┐
                │ ANN nearest-K          │
                └───────────┬───────────┘
                            │
                ┌───────────▼───────────┐
                │ Unified LLM decision:  │  (T2)
                │ ADD / UPDATE /         │
                │ SUPERSEDE / NOOP       │
                │ + subsumption check    │  (A7)
                │ + scope check          │  (B3)
                │ + modality check       │  (B5)
                └───────────┬───────────┘
                            │
                ┌───────────▼───────────┐
                │ Write with bi-temporal │  (T1)
                │ (valid_at, invalid_at, │
                │ ingested_at)           │
                │ Idempotency key        │  (I2)
                └───────────┬───────────┘
                            │
                ┌───────────▼───────────┐
                │ Bayesian confidence    │  (T4)
                │ over distinct sources  │
                │ + derivation depth cap │  (C4)
                └───────────┬───────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────▼─────┐   ┌─────────▼────────┐  ┌──────▼─────┐
   │ Decay    │   │ Reflection cron  │  │ Consolidate│
   │ cron     │   │ (Gen Agents)     │  │ + dedup    │
   │ resurrect│   │ promote insights │  │ cron       │
   │ on match │   │ Session→Project  │  │            │
   │ (D5)     │   │ Project→Company  │  │            │
   └──────────┘   │ Company→Portfolio│  └────────────┘
                  │ (T5)             │
                  └──────────────────┘

                         RETRIEVE
                            │
                ┌───────────▼───────────┐
                │ Query classifier       │
                │ (lookup vs multi-hop)  │
                └─────┬──────────────┬──┘
                      │              │
              lookup  │              │  multi-hop
                      ▼              ▼
              ┌─────────────┐   ┌──────────────┐
              │ BM25 + dense│   │ HippoRAG PPR │  (T8)
              │ + graph hop │   │ over entity  │
              │ + RRF (T7)  │   │ graph        │
              └──────┬──────┘   └──────┬───────┘
                     │                 │
                     └────────┬────────┘
                              │
                  ┌───────────▼───────────┐
                  │ Cross-encoder rerank   │  (T7)
                  └───────────┬───────────┘
                              │
                  ┌───────────▼───────────┐
                  │ MMR for diversity      │  (T7)
                  └───────────┬───────────┘
                              │
                  ┌───────────▼───────────┐
                  │ Visibility filter at   │  (G1)
                  │ query time (current    │
                  │ portfolio membership)  │
                  └───────────┬───────────┘
                              │
                              ▼
                          AGENTS

                       LEARNING LOOP
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────▼─────────┐   ┌─────▼──────┐   ┌───────▼─────────┐
   │ Stratified    │   │ Pattern    │   │ Constitution-   │
   │ calibration   │   │ mining +   │   │ based audit     │
   │ + Brier +     │   │ Voyager    │   │ (T9)            │
   │ resolution    │   │ skill lib  │   │                 │
   │ (T10, J1-J11) │   │ (T11)      │   │ Priority sample │
   │               │   │            │   │ high-conf items │
   │ Real vs       │   │ Diversity  │   │ (N2)            │
   │ synthetic     │   │ requirement│   │                 │
   │ separate (J4) │   │ + stale    │   │                 │
   │               │   │ retirement │   │                 │
   │ Decision vs   │   │ (M1, M2)   │   │                 │
   │ prediction    │   │            │   │                 │
   │ separate (J10)│   │            │   │                 │
   └──────┬────────┘   └─────┬──────┘   └────────┬────────┘
          │                  │                   │
          └──────────────────┼───────────────────┘
                             │
                  ┌──────────▼──────────┐
                  │ DSPy + MIPROv2 on    │  (T6)
                  │ extractor/judge      │
                  │ prompts (offline)    │
                  └──────────────────────┘
```

---

# PART 6 · Implementation Plan Deltas

Concrete additions to [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) (applied in v4):

## Phase 0 additions
- `MemoryItem` schema fields: `valid_at`, `invalid_at`, `ingested_at`, `embedding_model_version`, `claim_modality`, `derivation_depth`, `idempotency_key`, `quarantined: bool`, `canonical_form` (text), `provenance_cluster_id`
- `Prediction` schema fields: `outcome_class: real | synthetic`, `intervention_taken: bool`, `derivation_depth`
- New `Decision` table separate from `Prediction` (J10)
- New `source_trust_register` table (T12)
- Idempotency-key enforcement on every memory write (I2)
- Unique constraint on `(memory_item_a_id, memory_item_b_id)` in contradiction table (I1)

## Phase 1 additions
- **Workstream 1.4a · Unified extraction decision**: replace separate extract/dedup/contradict with one LLM call returning ADD/UPDATE/SUPERSEDE/NOOP (T2)
- **Workstream 1.4b · Canonical proposition normalization** before embedding (T3)
- **Workstream 1.4c · Multilingual embedding for dedup pass** (A4)
- **Workstream 1.4d · Structured numeric claim schema** with unit + period normalization (A5)
- **Workstream 1.4e · Source-trust register + quarantine tier** (T12, C5)
- **Workstream 1.4f · Reflection cron** (Generative Agents pattern, T5)
- Hybrid retrieval upgrade: RRF + cross-encoder rerank + MMR (T7)

## Phase 2 additions
- **Workstream 2.8 · Multi-hop retrieval (HippoRAG PPR)** gated by query classifier (T8)
- Query classifier ("lookup" vs "multi-hop / analogy")

## Phase 4 additions
- **Workstream 4.6a · DSPy + MIPROv2 offline optimization** on extractor + judge prompts using Prediction Ledger as labeled set (T6) — joins hot-path distillation phase

## Phase 6 additions
- **Workstream 6.1a · Stratified calibration + Brier + resolution** scoring (T10, J1, J3)
- **Workstream 6.1b · Real vs synthetic outcome separation** in calibration sets (J4)
- **Workstream 6.1c · Rolling-window calibration** (J6)
- **Workstream 6.1d · Bayesian priors for sparse classes** (J8)
- **Workstream 6.3a · Voyager-style skill library for procedural memory** (T11, M3)
- **Workstream 6.3b · Playbook diversity requirement + stale retirement** (M1, M2)
- **Workstream 6.5a · Constitution-based audit** (T9, N3)
- **Workstream 6.6 · Causal attribution with hand-curated confounder DAGs** per industry (L1)

---

# PART 7 · New Critical Patterns for CLAUDE.md

Added as C19–C25:

- **C19 · Bi-temporal everything** — every memory write sets `(valid_at, invalid_at=NULL, ingested_at)`. Retract flips `invalid_at`, never DELETE.
- **C20 · Canonical-form before embedding** — never embed raw text; embed the normalized S-P-O-qualifier rewrite.
- **C21 · Confidence aggregates over distinct provenance clusters** — never count same-source mentions as reinforcement.
- **C22 · Embedding versioning** — every vector carries `embedding_model_version`; migrations are dual-write batches, never silent.
- **C23 · ADD / UPDATE / SUPERSEDE / NOOP is one decision** — never split extract/dedup/contradict into separate passes that can disagree.
- **C24 · Quarantine for low-trust sources** — new facts below source-trust threshold are stored but NOT retrievable in Portfolio/Global layers until corroborated by ≥ 2 independent sources.
- **C25 · Proper scoring rules for calibration** — Brier + resolution; never accuracy alone (Goodhart).

---

# Document History

- **v1 · 2026-05-20** — Initial review. 50+ edge cases enumerated, 14 critical gaps identified, 12 external techniques selected for adoption, 9 anti-patterns formalized. Drove `IMPLEMENTATION_PLAN.md` v4 additions and `CLAUDE.md` C19-C25.

---

## Appendix · Sources

External research subagent compiled from training-knowledge of:
- **Mem0** — mem0ai/mem0 (two-phase extract/update, fact-level granularity, K-NN judge)
- **Letta** (formerly MemGPT) — letta-ai/letta (agent-editable memory blocks, sleep-time agents)
- **Cognee** — topoteretes/cognee (ECL pipeline, Pydantic-typed nodes)
- **Graphiti / Zep** — getzep/graphiti (bi-temporal model, edge invalidation, episode-anchored provenance, typed entities)
- **A-MEM** — Xu et al. 2025 (Zettelkasten linking, write-time neighbor mutation)
- **HippoRAG / HippoRAG 2** — OSU-NLP-Group (Personalized PageRank multi-hop retrieval)
- **MemoRAG** — qhjqhj00 (draft-then-retrieve pattern)
- **Voyager** — MineDojo/Voyager (skill library as procedural memory, automatic curriculum, outcome-gated promotion)
- **Generative Agents** — joonspk-research (reflection trees, recency+importance+relevance scoring)
- **Reflexion** — noahshinn/reflexion (verbal self-reflection memory)
- **DSPy** — stanfordnlp/dspy (Signatures, MIPROv2, BootstrapFewShot)
- **TextGrad** — zou-group/textgrad (natural-language gradients on prompts)
- **Constitutional AI** — explicit principle-based critique-and-revise
- **GraphRAG** — Microsoft (Leiden communities, per-community summaries)
- **PathRAG, LightRAG** — multi-hop variants

Citation confidence: high for 2024–early-2025 patterns; lower for very recent (2025–2026) systems like MIRIX, A-MEM exact arxiv IDs, and post-cutoff Graphiti/Letta API changes — verify on repos before locking in API-level decisions.

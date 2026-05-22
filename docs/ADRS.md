# Architecture Decision Records

> IMPLEMENTATION_PLAN.md Phase 8, Workstream 8.4 — an ADR for every major
> architecture choice. Each record states the decision, why it was made, and
> what it costs. Append-only; supersede rather than rewrite.

---

## ADR-001 · MySQL as the primary database

**Status:** Accepted (resolves Open Decision OD2)

**Context.** The platform needs a relational store for tenants, companies,
projects, memory items, the prediction ledger, audit logs, and telemetry. The
deployment target is the Manus platform.

**Decision.** Use MySQL 8.x (TiDB-compatible). Drizzle ORM for schema and
queries.

**Why.** Manus provides managed MySQL; adopting it removes an infra dependency
the project would otherwise own. MySQL 8 has the JSON column type needed for
embedding vectors and metadata. TiDB compatibility keeps a horizontal-scale
path open.

**Cost.** No native vector type — see ADR-002. No `downlevelIteration` in the
framework tsconfig, so `Set`/`Map` iteration must go through `Array.from()`.

---

## ADR-002 · App-side cosine similarity over a JSON embedding column

**Status:** Accepted

**Context.** Hybrid memory retrieval needs vector similarity search. MySQL has
no pgvector equivalent.

**Decision.** Store embeddings in a MySQL JSON column. Compute cosine
similarity in application code, then fuse with lexical scores via Reciprocal
Rank Fusion and diversify with Maximal Marginal Relevance.

**Why.** Keeps the database choice (ADR-001) intact. Retrieval math is pure,
deterministic, and fully unit-tested. For the expected per-company memory
sizes this is fast enough.

**Cost.** Full-scan similarity does not scale to millions of vectors per
company. Revisit with an external vector index if a company's memory grows
past the point where app-side scan stays within the latency SLO.

---

## ADR-003 · The LLM Router is the sole model dispatch point

**Status:** Accepted (Critical Pattern C3)

**Context.** Model calls must be uniformly redacted, budgeted, logged, and
traced.

**Decision.** `server/ai/router.ts` is the only file permitted to call an LLM
or embedding API. All domain code calls `router.complete()`, `router.embed()`,
or `router.structured()`. Provider SDKs are never imported elsewhere.

**Why.** Centralises PII redaction (C5), budget enforcement (P8), per-call
cost logging, trace IDs, and model selection from `models.yaml`. One place to
change a provider, one place to audit.

**Cost.** Every new model capability must be threaded through the router
interface.

---

## ADR-004 · Bi-temporal memory — supersede, never delete

**Status:** Accepted (Critical Pattern C19)

**Decision.** Memory claims are never hard-deleted. A new claim that replaces
an old one marks the old one superseded with a validity interval; the history
remains queryable.

**Why.** Strategy reasoning needs to know not just what is true now but what
was believed when a past decision was made. Calibration depends on it.

**Cost.** Storage grows monotonically; the hygiene cron archives low-confidence
superseded items rather than deleting them.

---

## ADR-005 · Prediction ledger — no strategic claim ships without an entry

**Status:** Accepted (Critical Pattern C2)

**Decision.** Every LLM response that emits a strategic claim records a
prediction-ledger entry in the same transaction. War-game and other simulated
outcomes are recorded with `outcomeClass: "synthetic"`.

**Why.** The learning loop can only calibrate what it recorded. Recording at
emission time, transactionally, means no claim escapes measurement.

**Cost.** Write amplification on every reasoning call; accepted as the price of
a measurable system.

---

## ADR-006 · Defensive output parsing — the verdict is never the model's

**Status:** Accepted

**Decision.** Every agent that returns a judgement exposes a pure, unit-tested
normalization function. Binary verdicts (red-team survived, vague-OKR flag,
drift severity, playbook promotion, pre-mortem launch gate) are computed by
deterministic code from the model's structured output — never read directly
from a model-provided boolean.

**Why.** LLM output is treated as an untrusted input. Determinism makes the
platform's judgements testable and stable.

**Cost.** More code per agent; paid back in test coverage and predictability.

---

## ADR-007 · Synthetic outcomes are scored separately from real ones

**Status:** Accepted (Heuristic J4)

**Decision.** War-game, cross-company war-game, and apply-deep-mode outcomes
are tagged `synthetic` and the calibration scorecard scores them in a separate
stratum from real outcomes.

**Why.** Synthetic outcomes are abundant and cheap; real outcomes are scarce
and slow. Mixing them would let simulation drown out reality in the
calibration record.

**Cost.** Two strata to maintain and display.

---

## ADR-008 · Cross-company reads — GP-only, three-layer enforcement, audited

**Status:** Accepted (Critical Pattern C1)

**Context.** The platform is company-namespaced by default. The
cross-company war-game, Synergy Scout, and pattern distillation deliberately
read across that boundary.

**Decision.** Every cross-company feature enforces three layers: (1) API —
`gpProcedure`; (2) query — every `companyId` validated against the tenant; (3)
UI — the route is GP-only in navigation. Every cross-company memory read writes
a restricted-tier audit entry. The agent still namespaces each memory search to
a single company — it never issues a cross-company query.

**Why.** The boundary cross is the highest-risk operation in the system; it is
made rare, explicit, authorised, and logged.

**Cost.** Boilerplate per cross-company feature; accepted.

---

## ADR-009 · tRPC for end-to-end type safety

**Status:** Accepted

**Decision.** The client–server contract is tRPC 11 with Zod input schemas.

**Why.** One source of truth for types; no generated client; compile-time
breakage when a procedure changes.

**Cost.** `apply` is a reserved procedure name — the Share-and-Apply procedure
is `applyToCompany`.

---

## ADR-010 · Build/deploy split — Claude writes code, Manus deploys

**Status:** Accepted

**Decision.** All application code is written and pushed to GitHub by Claude
Code. Manus AI pulls and publishes (deploys) to Manus infrastructure. Bugs
found on the deployed app are reported back to Claude, fixed, and pushed; Manus
re-pulls. Secrets live in the Manus Vault and are injected as environment
variables at runtime — never committed.

**Why.** Clear ownership: one writer of code, one operator of infrastructure.
Avoids force-push conflicts.

**Cost.** Database-backed code paths are typecheck/build-verified locally;
their integration tests run on the Manus deployment. Verification of DB code
happens on deploy plus user bug reports.

---

## ADR-011 · In-process TTL + LRU cache for embeddings

**Status:** Accepted (Phase 8, Workstream 8.1)

**Decision.** Embeddings are cached in-process with a 24h TTL and LRU
eviction, keyed by a hash of model + dimensions + redacted text. A cache hit
returns immediately, costing nothing and skipping the budget check and call
log.

**Why.** Embeddings are deterministic per text and model; the same chunk is
frequently re-embedded across ingest, search, and reflection. The cache is
dependency-free and per-process.

**Cost.** Cache is not shared across processes/instances — each instance warms
its own. Acceptable at current scale; revisit with a shared cache (Redis) if
horizontal scale-out makes per-instance warming wasteful.

# Strategy Platform — Phase 0 TODO

## Schema & Database
- [x] Tenant, Company, StrategyProject, Session tables with full namespacing
- [x] User table extended with role (gp / operator / portco_team)
- [x] MemoryItem table with all v4 bi-temporal fields (valid_at, invalid_at, ingested_at, embedding_model_version, claim_modality, derivation_depth, idempotency_key, quarantined, canonical_form, provenance_cluster_id)
- [x] Prediction table (claim, confidence, framework, model, horizon, target_date, outcome_class, intervention_taken, derivation_depth)
- [x] Decision table (separate from Prediction per J10)
- [x] Outcome table (closes a prediction)
- [x] Contradiction table with unique constraint on (a_id, b_id)
- [x] source_trust_register table seeded with defaults
- [x] AuditLog table (append-only)
- [x] UsageEvent table (append-only)
- [x] LlmCallLog table (per-call cost recording)
- [x] Dimensions enums (market, segment, geo, decay_class, visibility, claim_modality)

## Auth & Namespacing (Workstream 0.1)
- [x] 3-role JWT: GP / Operator / PortCoTeam via Manus OAuth
- [x] requireGP / requireOperator / requirePortCoTeam middleware
- [x] Seed GP users: gpai@msn.com and paigautham@gmail.com
- [x] Company switcher UI in header
- [x] Namespace enforcement: every DB write carries tenant_id + company_id

## Audit Log & Usage Events (Workstream 0.1)
- [x] Audit log middleware: append-only entry on every confidential read
- [x] Usage event emitter: emits on create-project, write-memory, run-llm
- [x] Usage events queryable via tRPC procedure

## LLM Router + MCP Gateway (Workstream 0.2)
- [x] router.complete() — wraps Manus built-in LLM, runs redactor first
- [x] router.embed() — wraps Manus built-in LLM for embeddings
- [x] router.structured() — wraps Manus built-in LLM for JSON schema output
- [x] Provider SDKs never imported outside server/ai/router.ts
- [x] MCP gateway with declarative tool registry and dispatch
- [x] web_search tool registered
- [x] web_fetch tool registered
- [x] edgar_filings tool registered
- [x] lookup_memory tool registered
- [x] models.yaml with task→model mapping + BGE-M3 deferred slot

## Budget Enforcer (Workstream 0.2)
- [x] Per-call (token, time, $) envelope
- [x] Warn at 80% of soft cap
- [x] Block at 100% of soft cap
- [x] Hard-kill at 1.5× estimate (no override)

## PII Redactor (Workstream 0.5)
- [x] Redactor runs inside router.complete/embed/structured (not opt-in)
- [x] Strips SSN, credit card, email, phone
- [x] No bypass path

## Memory Schema + Prediction Ledger (Workstream 0.3)
- [x] write_memory() with all C1 namespace params
- [x] query_memory() with company-scoped isolation (cross-tenant returns nothing)
- [x] Bi-temporal supersede pattern (no DELETE)
- [x] Canonical form normalization before embedding (C20)
- [x] record_prediction() in same transaction as LLM claim
- [x] close_prediction() with outcome
- [x] provenance_cluster_id in schema + aggregate_confidence() stub

## Cost Dashboard (Workstream 0.4)
- [x] Per-call cost recording (user, company, project, session, model, tokens_in, tokens_out, $)
- [x] Cost dashboard UI: per-user / per-company / per-session views
- [x] Soft cap enforcement with warn/block
- [x] OpenTelemetry trace ID on every LLM call

## Security & Export (Workstream 0.5)
- [x] Per-portco encrypted archive export endpoint
- [x] Signed download URL returned from export
- [x] Daily backup cron (server-side scheduled job)
- [x] Nightly usage-telemetry aggregation cron

## Frontend (Phase 0 minimal)
- [x] Login page (Manus OAuth)
- [x] Company switcher in top bar (active company always visible)
- [x] New-Company creation form
- [x] New-StrategyProject creation form
- [x] Cost Dashboard page (per-user / per-company / per-session)
- [x] Status page (latest MemoryItem, latest Prediction, latest LLM call cost)
- [x] Audit Log viewer page
- [x] Usage Events viewer page
- [x] Dark theme, Cinzel headings, Cormorant Garamond body

## Tests & Seed
- [x] scripts/seed_phase0.ts — seeds TestCo, StrategyProject, MemoryItem, Prediction
- [x] tests/test_namespacing — proves cross-tenant isolation
- [x] tests/test_redactor — proves SSN/CC/email stripped before LLM
- [x] tests/test_router_no_provider_leak — static check provider SDKs only in router.ts
- [x] tests/test_phase0_acceptance — integration tests for all 8 acceptance criteria

## Docs
- [x] Update MASTER.md with Phase 0 status and resolved ODs
- [x] .env.example with ZEP_API_KEY slot and all required vars

## Phase 0 Review Fixes (2026-05-21)
- [x] B2 — Real embeddings: call OpenAI text-embedding-3-small via direct HTTPS (Manus forge has no /v1/embeddings)
- [x] B3 — embeddingModelVersion: stamp with actual model string returned from OpenAI, not hardcoded
- [x] B4 — 8 real integration tests against live DB: cross-company isolation with seeded data in two companies
- [x] M1 — Router reads models.yaml for model selection; no hardcoded DEFAULT_MODEL
- [x] M2 — supersedeMemory runs in a single DB transaction; no -1 placeholder
- [x] M3 — CI workflow present and green (already on GitHub; verify it passes)
- [x] M4 — structured() validates output against JSON schema, not just JSON.parse
- [x] OPENAI_API_KEY secret added to Manus secrets for embeddings

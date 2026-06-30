# CLAUDE.md — Strategy Platform Project Instructions

> Project conventions, rules, and patterns for Claude Code (and any coding agent) working on the strategy platform built on top of MiroFish.
>
> **This section is the single most important thing in this file. Read it before making any non-trivial change. Each rule is here because breaking it would cause a production incident or a costly rework, and several of these rules are forward-projections from incidents observed on a sibling project (Meridian).**

---

## ⚠️ STACK CORRECTION — read before trusting any code snippet in this file

This file was imported from the original (pre-build) plan, which assumed a
**Python/FastAPI + Vue + Zep/Postgres** stack. **That stack was never built.** The
actual, shipped, deployed product (Cairn) is **TypeScript end-to-end**. The
Critical Patterns C1–C25 below remain valid as *principles*; their **Python code
examples and `backend/app/...` file paths are illustrative pseudocode only** —
map them to the real TypeScript locations:

| Doc says (illustrative) | Real location |
|---|---|
| `backend/app/ai/router.py` | `server/ai/router.ts` (`complete` / `embed` / `structured`) |
| `backend/app/ai/mcp_gateway.py` | `server/ai/mcp-gateway.ts` |
| `backend/app/security/redactor.py` | `server/ai/redactor.ts` |
| `backend/app/ai/budgets.py` | `server/ai/budget.ts` |
| `backend/app/services/*.py` | `server/services/*.ts` (kebab-case, e.g. `kpi-library.ts`) |
| `backend/app/agents/*.py` | `server/agents/*.ts` |
| `backend/app/models/*.py` (Pydantic/SQLAlchemy) | `drizzle/schema.ts` (Drizzle) + `shared/types.ts` |
| `frontend/src/**/*.vue` | `client/src/**/*.tsx` (React 19) |
| Zep + Postgres + pgvector | MySQL/TiDB via Drizzle; app-side cosine/RRF/MMR retrieval |

## Project Facts

| | |
|---|---|
| **Project name** | Cairn (rebranded from "Strategy Platform" 2026-05-22) |
| **Built on** | MiroFish — multi-agent prediction engine (patterns reused) |
| **Primary working directory** | `C:\Users\GPai\claude co work work folder\My apps\strategy-platform` |
| **Doc home** | `docs/` (this folder) |
| **Backend** | **TypeScript** — Express 4 + tRPC v11, `tsx`/`esbuild`, pnpm |
| **Frontend** | **React 19** + Vite + Tailwind 4 + shadcn/ui (not Vue) |
| **Memory** | **MySQL/TiDB** via Drizzle ORM; embeddings in a JSON column, app-side cosine + RRF + MMR (not Zep/pgvector) |
| **LLM access** | OpenAI embeddings + Manus "forge" completions, all via `server/ai/router.ts` |
| **Hosting** | **Manus** (deployed live; ADR-010: Claude pushes code, Manus deploys + runs migrations on publish) |
| **Tenancy** | Multi-company namespacing enforced on every row from day one (P1, C1) |
| **Deployment** | Push to GitHub → Manus publishes. No separate CI/CD deploy. |

---

## Companion documents (READ THESE FIRST)

| Doc | When to read |
|---|---|
| [PROJECT_MAP.md](./PROJECT_MAP.md) | **FIRST.** The feature & file map — every surface → route → page → router → service/agent files → status. Use it to locate code, and **update it in the same commit as any feature change.** |
| [GUIDING_PRINCIPLES.md](./GUIDING_PRINCIPLES.md) | Before any architecture debate. Cite Pn / Hn in PRs. |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | To find which phase a deliverable belongs to + acceptance gates. |
| [MASTER.md](./MASTER.md) | To get current project state, recent changes, feature status. Updated on every major change. |
| [UX_DESIGN.md](./UX_DESIGN.md) | Before any frontend / UX work. Cite DPn for design decisions. |
| [DEFERRED_BACKLOG.md](./DEFERRED_BACKLOG.md) | Before proposing a "new feature." It may already be deferred with promotion criteria. |

---

# CRITICAL — DO NOT BREAK THESE PATTERNS

Each rule below maps to a numbered principle from [GUIDING_PRINCIPLES.md](./GUIDING_PRINCIPLES.md). The principles doc explains *why*; this section is *what you must do at the code level*.

## C1 · Multi-company namespacing — every write, every read (P1)
Every storage operation, queue message, cache key, embedding namespace, log line, and audit entry carries `tenant_id`, `company_id`, `project_id`, and (where applicable) `session_id`. **Never** add a table or service that "we'll add tenant_id to later." A migration that forgets a column is recoverable; a table that forgets the column is a tear-down.

```python
# Bad
def write_memory(content: str, embedding: list[float]) -> MemoryItem: ...

# Good
def write_memory(
    *,
    tenant_id: str,
    company_id: UUID,
    project_id: UUID | None,
    session_id: UUID | None,
    content: str,
    embedding: list[float],
    ...
) -> MemoryItem: ...
```

Cache keys: `f"{tenant_id}:{company_id}:{cache_key}"`. Always.

## C2 · Prediction ledger entries on every claim that ships (P2)
Any recommendation, forecast, framework output, MCDA score, option ranking, war-game outcome, or memo claim that ships to a user **must** have a corresponding `Prediction` ledger entry created in the same transaction. No retroactive ledger entries. No "we'll track outcomes later." Calibration cannot exist if predictions weren't recorded when made.

```python
# When emitting any strategic claim:
prediction_id = record_prediction(
    claim=...,
    confidence=...,
    framework=...,
    model=...,
    horizon=...,
    target_date=...,
)
# Attach prediction_id to the artifact you ship.
```

## C3 · Tools through MCP, models through router — NEVER call provider SDKs directly (P3)
**No `import anthropic` / `import openai` / `import google.genai` in any domain module.** Provider SDKs are imported only inside `backend/app/ai/router.py` and `backend/app/voice/provider.py`. Domain code calls `router.complete()`, `router.embed()`, `router.structured()`, or the voice provider abstraction.

Same for tools: every tool call goes through the MCP gateway. No `requests.get(...)` to a third-party API inside an agent module — register a tool, call it through MCP.

The reason: provider churn (model deprecations, pricing changes, new providers) is constant. Today's GPT-5 is tomorrow's GPT-6. The router exists so swapping models is a config change, not a refactor.

## C4 · Diagnosis precedes frameworks — no framework picker UI (P4)
Frameworks are internal capabilities of the Reasoning Mesh, selected by the Diagnosis agent based on question type. **Never** add a user-facing dropdown "Choose a framework: Porter / JTBD / Ansoff…". If a designer or PM asks for one, point them to this rule and to UX principle DP1.

## C5 · Redaction before any LLM call (P5)
The redaction layer (`backend/app/security/redactor.py`) runs on **every** LLM input. Bypass = security incident. If a code path needs raw PII (e.g., specific portco analysis where redacted text loses meaning), it must:
1. Use the on-prem model lane (Phase 8) — not a hosted frontier model
2. Be tagged with `confidentiality_tier="high"` in the request
3. Be audit-logged with full justification

No exceptions for "quick test" / "just this once."

## C6 · Audit log every read of confidential data (P5)
Every API endpoint that returns portco-confidential data writes an audit log entry. The middleware enforces this. If you write a new endpoint that bypasses the middleware, you have created a security gap.

## C7 · Budget enforcement is server-side, not client-side (P8, H4)
Every LLM call goes through `budgets.py` with a `(token, time, $)` envelope. Hard kill at 1.5× estimate. **Never** rely on client UI to limit calls — a runaway agent must die at the budget enforcer, not at the user noticing.

## C8 · One session = one Zep namespace, never global (P1)
Zep memory writes go to `tenant.company.project` namespaces. **Never** write to a global namespace, even for "shared knowledge." Global memory (industry knowledge, framework definitions) goes to the `global_memory` table with explicit `visibility="global"` — not Zep.

## C9 · Briefing-default outputs (H6)
Every artifact-generating agent returns a **1-page memo** by default. Deeper outputs require explicit user request (UI toggle or voice command). This is enforced in the agent runtime, not in the UI. If you build an artifact agent and its default output is > ~400 words of prose, you've violated this.

## C10 · Confidence + provenance on every claim emitted (H9)
Any structured output from an agent that contains a factual claim **must** include `confidence: float` and `provenance: list[Source]` fields. Even internally-consumed claims. The hybrid retrieval layer uses these; missing them silently weights claims wrong.

## C11 · Hierarchical agents with JSON handoffs — never free-form mesh (H4)
Chief Strategist dispatches to specialists; specialists return structured outputs conforming to a declared Pydantic schema; specialists never call each other directly. If you're tempted to wire two agents peer-to-peer, route through the orchestrator runtime instead. Free-form meshes become impossible to debug at runtime.

## C12 · Every step idempotent and resumable (H4)
Every agent step persists state to the database before progressing. A crash → restart resumes from the last persisted step, never replays. If you write a step that holds intermediate state only in memory, you've introduced a non-recoverable failure mode.

## C13 · Voice never auto-commits — always draft → tray → confirm (H3)
Voice extracts go to `*_drafts` tables. User reviews in a tray and confirms before commit. The realtime tools `capture_hypothesis`, `capture_option`, etc. write drafts only. If you add a voice tool that commits directly, you've broken H3 and will get bitten by the first false-positive extraction.

## C14 · Mini-player decoupled from full overlay (H3, Meridian lesson)
`isCallActive` and `isOverlayOpen` are independent booleans. Closing the overlay must not disconnect the call when `connectionState === "connected"`. Otherwise the user loses their session every time they navigate.

## C15 · Two UX tiers, one backend (P7)
Same backend powers both GP tier (deep, multi-surface) and Operator tier (voice-first, briefing-default, embedded in Slack/Notion/Linear). **Never** fork backend logic by tier. UX complexity is a presentation-layer concern.

## C16 · Realtime voice: Gemini Live default, OpenAI Realtime opt-in — both WebSocket + PCM16, NEVER WebRTC (corrected Meridian lesson)
**This rule was reversed TWICE by Meridian's own production experience — heed the corrected version, verified against the latest Meridian (2026-06-30, PR #922).**

1. **WebRTC is out.** The original rule said "use WebRTC for native echo cancellation." Right on desktop, wrong in production: WebRTC dropped audio on iOS WKWebView and four PRs (#276/#278/#279/#283) could not fix it. Transport is **WebSocket + PCM16**, never WebRTC.
2. **Gemini Live is the DEFAULT engine; OpenAI Realtime is the opt-in fallback.** Even over WebSocket, OpenAI Realtime is unreliable on iOS Capacitor WKWebView (WebKit Bug 190552, open since 2018) and its prompt cap truncates tool-routing rules. Gemini Live "works perfectly" — wide context window, no cap. Meridian's `userSettings.voiceEngine` defaults to `'gemini'` with an explicit "DO NOT re-promote OpenAI to default" rule (`docs/openai-realtime-ios-final-verdict-2026-05-13.md`). Cairn mirrors this: `realtime.createSession`'s `provider` input defaults to `'gemini'`.

Cairn ships BOTH ported engines behind one `VoiceEngine` interface so the provider is a drop-in swap (`client/src/contexts/VoiceCallContext.tsx`):
- **Gemini Live (default)** — `client/src/lib/geminiLiveEngine.ts` (PCM16 **16kHz in / 24kHz out** — asymmetric), `server/_core/geminiRealtime.ts`. Mint: `POST v1alpha/auth-tokens` with `x-goog-api-key`, token returned in the **`name`** field (NOT `token` — a latent bug in Meridian's own reference), passed by the client as `?access_token=` on the **v1alpha** `BidiGenerateContentConstrained` WS. Raw-key fallback uses **v1beta** `?key=` (degraded — ships the key to the browser; only on mint failure / `GEMINI_USE_EPHEMERAL_TOKENS=false`). Model `gemini-3.1-flash-live-preview`. Needs `GOOGLE_GEMINI_API_KEY` with Live API access. `setMicMuted` is **gain-based, never `track.enabled=false`** — disabling the track starves Gemini's VAD and hangs the session.
- **OpenAI Realtime (opt-in)** — `client/src/lib/openaiRealtimeWsEngine.ts` (PCM16 24kHz both ways). Mint via GA `POST /v1/realtime/client_secrets` (`server/_core/realtime.ts`); raw `OPENAI_API_KEY` never reaches the browser. Do NOT send the `openai-beta.realtime-v1` subprotocol — a GA client secret cannot start a Beta session.

Shared across both: the compact system prompt + read-only lookup tools live ONCE in `server/_core/realtime.ts` (`buildVoiceSystemPrompt`, `REALTIME_TOOLS`); Gemini only re-shapes the tools to `functionDeclarations`. Manual mic-gating (250ms post-speech unmute, hard mic-duck during AI speech) is bounded and is the price of iOS support. The call is decoupled from the overlay (C14).

## C17 · Compact prompt + on-demand lookup tools — never dump context (Meridian lesson)
At Meridian, dumping all user data into the system prompt blew up at 15-30K tokens and caused mid-sentence truncation. Strategy data is much larger. Default system prompts are < 5K tokens; agents call `lookup_company`, `lookup_segment`, `lookup_competitor`, `lookup_memory` on demand.

## C18 · Static-prefix → user-data-suffix for prompt caching
Long static instructions go at the top of the system prompt. User/portco-specific context goes last. OpenAI and Anthropic both cache repeated prefixes — savings up to 90%. Reorder a system prompt randomly and you lose this.

## C19 · Bi-temporal everything (memory)
Every memory write sets `(valid_at, invalid_at=NULL, ingested_at)`. Retraction flips `invalid_at`, never DELETE. Retrieval defaults clamp to `valid_at ≤ now AND (invalid_at IS NULL OR invalid_at > now)`. "As-of" queries override `now`. Reason: Prediction Ledger audit demands "what did we believe at decision time?" — destroying history makes calibration impossible. Source: Graphiti pattern.

```python
# Bad — destructive update
memory_item.content = new_content
db.commit()

# Good — supersede
old.invalid_at = now()
new = MemoryItem(content=new_content, valid_at=now(), supersedes=old.id)
db.add(new)
db.commit()
```

## C20 · Canonical-form before embedding
Never embed raw text. Embed the LLM-normalized S-P-O-qualifier rewrite. Store both raw and canonical. Reason: makes paraphrase dedup tractable, makes cross-lingual dedup possible, makes hierarchical subsumption checks feasible. Failing this rule = dedup never works at scale.

## C21 · Confidence aggregates over distinct provenance clusters
Reinforcement counts **only** from distinct sources, where "distinct" = different publisher / domain / author / extraction batch. The same article quoted 20 times = 1 reinforcement. Formula: `confidence = 1 - Π(1 - r_i)` over distinct clusters i, with per-source reliability `r_i` from `source_trust_register`. Failing this rule = false high-confidence on echo-chamber facts.

## C22 · Embedding model versioning
Every vector carries `embedding_model_version`. Migrations are dual-write batches with explicit cutover, never silent. Searching across mixed-version vectors is forbidden — partition queries by version during migration windows. Failing this rule = catastrophic retrieval bug after model upgrade.

## C23 · ADD / UPDATE / SUPERSEDE / NOOP is one decision
Extraction worker makes ONE LLM call that sees `(new_fact, top-K nearest existing memories)` and returns one of those four actions. Never split into separate extract / dedup / contradict passes — they will disagree. SUPERSEDE replaces existing memory with `invalid_at=now` on the old item; new item created with `valid_at=now`. Source: Mem0 (with SUPERSEDE replacing destructive UPDATE).

## C24 · Quarantine for low-trust sources
Facts from sources below trust threshold (default 0.5) land in `quarantined=true` tier. They are stored and queryable within Company layer but **NOT retrievable in Portfolio / Global layers** until corroborated by ≥ 2 independent sources OR explicitly approved by GP. Reason: a single malicious / sloppy doc corrupting cross-portfolio reasoning is high-blast-radius.

## C25 · Proper scoring rules for calibration
Never score predictions with accuracy alone. Use **Brier score** for probabilistic claims (calibration component) **plus resolution / sharpness score** (information component) — penalize both miscalibration AND uninformativeness. Point estimates use squared error / MAPE. Tracked separately by scoring method. Reason: rewarding accuracy alone makes agents learn to hedge to 0.5 (Goodhart). Synthetic outcomes (war-game) calibrated in a separate cohort from real outcomes.

---

# KNOWN BUG PATTERNS — DO NOT RECREATE

(Empty at v1 — populated as bugs are fixed in production. Format below.)

```markdown
## KB#1 · <Short symptom title>
**Symptom:** What the user / system saw.
**Root cause:** Why it happened.
**Fix pattern:** The shape of the fix (with code snippet if helpful).
**Examples on `main`:** PR #X, PR #Y.
**Date added:** YYYY-MM-DD.
```

---

# RULES FOR SHIPPING A FEATURE

When a new feature ships in a PR, the **same PR** must update these named files:

| Type of feature | Files to update in the same PR |
|---|---|
| **Any new or changed feature/surface (always)** | **`docs/PROJECT_MAP.md`** (add/edit the feature row — files, status, one-liner) **+ `client/src/lib/manual-content.ts`** (a manual entry and/or FAQ item, so the in-app `/manual` help stays current) |
| New backend service or agent | `docs/strategy-platform/MASTER.md` (Recent Changes + Feature Status table) + `docs/strategy-platform/IMPLEMENTATION_PLAN.md` (mark workstream complete) |
| New API endpoint | OpenAPI spec + `docs/strategy-platform/MASTER.md` API section |
| New UI surface | `docs/strategy-platform/UX_DESIGN.md` (surface-by-surface section) + `docs/strategy-platform/MASTER.md` |
| New tool registered in MCP gateway | Tool catalog table in `docs/strategy-platform/MASTER.md` |
| New memory dimension or schema change | `docs/strategy-platform/IMPLEMENTATION_PLAN.md` Phase 0/1 schema + migration script |
| New principle or rule learned | This file (`CLAUDE.md`) Critical Patterns section + `GUIDING_PRINCIPLES.md` if it's a principle |
| Fixed a non-trivial bug | This file (`CLAUDE.md`) Known Bug Patterns section |
| New connector (Linear, Stripe, etc.) | Connector inventory in `MASTER.md` + per-portco permissions UI |

Generic "update docs" rules get ignored. Named-file rules don't.

---

# THE "ULTRA REVIEW" PROTOCOL (for bug-check requests)

When the user says "check this for bugs," "review this carefully," or anything implying high-stakes review, do **not** do a single linear scan. Do this instead:

1. **Decompose the surface area** into ≤ 6 distinct concern classes:
   - Security (P5)
   - Tenancy / namespacing (P1, C1)
   - Cost / budget (P8, C7)
   - Memory / prediction ledger consistency (P2, C2, C10)
   - Concurrency / idempotency (C12)
   - UX / accessibility (DP1-DP12)
   - Provider abstraction integrity (P3, C3)

2. **Dispatch one specialized subagent per concern class**, in parallel, scoped to that single concern. Subagents read actual code (not summaries).

3. **Each subagent returns:** `Findings (with severity: Blocker / Major / Minor / Nit)`, `Evidence (file:line)`, `Proposed fix (zero-risk where possible)`.

4. **You synthesize:** Deduplicate, rank by severity, produce a prioritized fix plan. Ship fixes in small, reviewable PRs.

The user values: **accuracy over speed, zero-risk over fast, thorough over partial.** A 5-minute single-pass scan is the wrong answer every time.

---

# SUBSYSTEM MAP

> ⚠️ The tree below is the **original Python/Vue plan**, kept for its subsystem
> *concepts and danger annotations* — NOT the built layout. See the Stack
> Correction at the top of this file for the real TypeScript locations
> (`server/ai/`, `server/services/`, `server/agents/`, `drizzle/schema.ts`,
> `client/src/pages/*.tsx`).

```
Strategy Platform (built on MiroFish)
│
├── backend/app/
│   ├── models/                        # Pydantic + SQLAlchemy schemas
│   │   ├── core.py                    # Tenant, Company, StrategyProject, Session
│   │   ├── memory.py                  # MemoryItem + dimensions  (P2, H8)
│   │   ├── prediction.py              # Prediction ledger        (P2, C2)
│   │   ├── contradiction.py           # CONTRADICTS edges
│   │   ├── initiative.py              # Strategy → Execution     (Phase 5)
│   │   └── okr.py                     # OKRs                     (Phase 5)
│   │
│   ├── ai/                            # ⚠️ THE ONLY PLACE provider SDKs are imported
│   │   ├── router.py                  # LLM router (text/embed/structured)  (C3)
│   │   ├── mcp_gateway.py             # MCP gateway              (C3)
│   │   ├── budgets.py                 # Server-side budget enforcement      (C7)
│   │   ├── cost_tracker.py            # Per-call cost recording  (P8)
│   │   └── models.yaml                # task → model mapping
│   │
│   ├── voice/                         # ⚠️ Realtime channel (separate from ai/router)
│   │   ├── provider.py                # Realtime provider abstraction       (C3)
│   │   ├── realtime.py                # WebRTC session            (C16)
│   │   ├── sessions.py                # Session lock + TTL
│   │   ├── brainstorm.py              # 4-phase state machine    (Phase 4)
│   │   ├── extractors.py              # capture_* tools          (C13)
│   │   └── personas.py                # Persona registry
│   │
│   ├── agents/                        # Agentic reasoning
│   │   ├── runtime.py                 # Hierarchical orchestrator (C11, C12)
│   │   ├── chief_strategist.py        # Top-level dispatcher
│   │   ├── diagnosis.py               # Diagnosis agent          (C4)
│   │   ├── research/                  # Specialist research agents
│   │   ├── frameworks/                # Framework library        (C4)
│   │   ├── option_generator.py        # Divergent + convergent
│   │   ├── mcda_evaluator.py          # Multi-criteria scoring
│   │   └── red_team.py                # Model-diversity critic ensemble
│   │
│   ├── services/                      # Domain services
│   │   ├── memory.py                  # Write/read API           (C1, C10)
│   │   ├── decomposer.py              # Strategy → Initiatives → OKRs
│   │   ├── war_game.py                # Multi-arena scenarios
│   │   ├── share_and_apply.py         # Strategy artifact → portco application
│   │   └── ... (extended from existing MiroFish services)
│   │
│   ├── portfolio/                     # Cross-company subsystem (GP only)
│   │   ├── detectors/                 # 9 synergy detectors
│   │   ├── distillation.py            # Anonymized pattern extraction
│   │   └── playbook_engine.py
│   │
│   ├── jobs/                          # Scheduled hygiene + learning
│   │   ├── decay.py                   # Nightly
│   │   ├── consolidate.py             # Weekly
│   │   ├── dedup.py                   # Nightly
│   │   ├── calibration.py             # Weekly
│   │   └── audit.py                   # Anti-hallucination
│   │
│   ├── security/
│   │   ├── redactor.py                # ⚠️ MUST RUN BEFORE EVERY LLM CALL (C5)
│   │   └── ...
│   │
│   ├── audit/                         # Audit log middleware    (C6)
│   ├── usage/                         # Usage event log         (P6)
│   ├── auth/                          # OIDC + 3-role JWT
│   └── config/
│
├── frontend/src/
│   ├── views/                         # Top-level routes per surface
│   ├── components/
│   │   ├── VoiceIntake.vue
│   │   ├── VoiceMiniPlayer.vue        # Persistent (C14)
│   │   ├── DiagnosisReview.vue
│   │   ├── ResearchLive.vue
│   │   ├── BrainstormReview.vue
│   │   └── ...
│   └── voice/                         # Frontend WebRTC client
│
└── docs/strategy-platform/            # ⚠️ Living docs — update with shipping
    ├── CLAUDE.md                       # This file
    ├── GUIDING_PRINCIPLES.md
    ├── IMPLEMENTATION_PLAN.md
    ├── MASTER.md
    ├── UX_DESIGN.md
    └── DEFERRED_BACKLOG.md
```

**Files to handle with extra care** (high blast-radius if broken):
- `backend/app/ai/router.py` — single point of model dispatch
- `backend/app/ai/mcp_gateway.py` — single point of tool dispatch
- `backend/app/security/redactor.py` — security gate
- `backend/app/services/memory.py` — every claim flows through here
- `backend/app/models/core.py` — tenancy primitives; schema breaks propagate everywhere
- `backend/app/voice/realtime.py` — fragile vendor interface; test with real WebRTC, not unit mocks

---

# CODE STYLE

## Python (backend)
- Type hints **mandatory** on every public function. Pydantic models for every cross-module data shape.
- Async-first (`async def`) for any I/O.
- No `print()` in production code — use `structlog` with structured fields including `tenant_id`, `company_id`, `trace_id`.
- Exceptions are exceptional. Don't `try/except` to suppress; raise a domain-specific error.
- **No silent empty `catch`** (Meridian KB: empty catches hid an entire class of UI bugs for months).

## TypeScript / Vue (frontend)
- Strict mode on.
- Composition API (`<script setup>`), no Options API.
- No `any`. If you need a quick escape, use `unknown` and narrow.
- Components in `PascalCase.vue`, composables in `useCamelCase.ts`.

## SQL / Migrations
- Every migration is reversible.
- **Never deploy a schema column before the code that uses it** (Meridian KB: this pattern caused 4 incidents).
- Index every column you query or filter by; review query plans on large tables.

## Naming
- Tables: snake_case singular (`memory_item`, not `memory_items` or `memoryItems`).
- API routes: `/api/v1/{resource}` REST-ish.
- Pydantic: `MemoryItem`, not `Memory_item`.
- Agent class names: `<Concept>Agent` (`DiagnosisAgent`, `RedTeamAgent`).

---

# TESTING

- **Unit tests** for pure logic.
- **Integration tests** that hit a real Postgres + Zep test instance. (Mocking the database in this project = false confidence; Meridian KB: real DB caught migration drift mocks missed.)
- **E2E tests** for critical flows: voice intake, research session end-to-end, strategy decomposition, sync round-trip.
- Pre-commit: `ruff` + `mypy --strict` + `eslint` + `vue-tsc --noEmit`.
- Pre-push: full unit + integration suite must pass.

---

# DEPLOYMENT NOTES (placeholder — finalize at Phase 0)

- Currently no auto-deploy. Pushes to `main` are not production deploys.
- When CI/CD lands: every push to `main` triggers staging build; production deploys are tagged releases.
- Until then: ship behind feature flags (per-tenant), validate manually with the test portco, promote when stable.

---

# TROUBLESHOOTING (Common Errors → Fixes)

(Empty at v1 — populated as common errors are hit and resolved.)

```markdown
| Error string | Fix |
|---|---|
| `ZepNamespaceNotFound: tenant.X.Y` | Run `python scripts/init_zep_namespaces.py --tenant X --company Y` |
| `pgvector extension not installed` | `CREATE EXTENSION IF NOT EXISTS vector;` then restart backend |
```

---

# OPEN QUESTIONS WHEN ONBOARDING TO THIS PROJECT

If you are picking up this project fresh, in order:

1. Read [GUIDING_PRINCIPLES.md](./GUIDING_PRINCIPLES.md) end-to-end.
2. Read this CLAUDE.md's Critical Patterns section.
3. Skim [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) to find the current phase.
4. Read [MASTER.md](./MASTER.md) for current state + recent changes.
5. Skim [UX_DESIGN.md](./UX_DESIGN.md) reference set + principles if doing any UI.
6. Then look at code.

Do **not** start coding before step 1-4. The 90 minutes spent reading saves weeks of rework.

---

## Document History

- **v2 · 2026-05-20** — Added Critical Patterns C19-C25 from [MEMORY_AND_LEARNING_REVIEW.md](./MEMORY_AND_LEARNING_REVIEW.md):
  - C19 — Bi-temporal everything (Graphiti pattern); no destructive updates on memory
  - C20 — Canonical-form normalization before embedding (S-P-O-qualifier)
  - C21 — Confidence aggregates over distinct provenance clusters (Bayesian over sources, not mentions)
  - C22 — Embedding model versioning + dual-write migrations
  - C23 — Unified ADD/UPDATE/SUPERSEDE/NOOP decision (Mem0 pattern, with SUPERSEDE replacing destructive UPDATE)
  - C24 — Quarantine tier for low-trust sources (memory-poisoning containment)
  - C25 — Proper scoring rules (Brier + resolution; never accuracy alone) to avoid Goodhart on calibration
- **v1 · 2026-05-20** — Initial CLAUDE.md. Patterns imported from Meridian's CLAUDE.md (Critical Patterns framing, Known Bug Patterns catalog, Ultra Review protocol, named-file shipping rule, troubleshooting table, subsystem map with danger annotations). 18 Critical Patterns (C1-C18) mapped to the 8 principles + 12 heuristics in [GUIDING_PRINCIPLES.md](./GUIDING_PRINCIPLES.md).

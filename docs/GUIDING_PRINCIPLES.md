# Strategy Platform — Guiding Principles

> The focus anchor. When in doubt during design, build, or feature debate, return here.
> Any decision that violates a principle requires explicit, written justification and a sunset condition.

---

## 0 · North Star

**Build a private, multi-company strategy platform where intelligence compounds with every session, every portfolio company, and every outcome — turning strategic decisions into executed work and learned lessons.**

We are not building a smarter chatbot. We are building a system whose moat is **data + loops + portfolio context**, on the assumption that LLMs themselves will commoditize.

The platform is also an **active reading partner**: drop in any external strategy (HBR article, competitor playbook, book excerpt, podcast clip, tweet thread), and the engine applies it to a chosen portco — extracting the thesis, scoring the fit, adapting the moves, and tracking the outcome. Every applied strategy becomes calibrated portfolio knowledge over time.

---

## 1 · The Eight Non-Negotiables

These cannot be cut, deferred, or "added later."

### P1 · Multi-company namespacing from line one
Every storage operation, every cache key, every memory write, every queue message, every log line carries `tenant_id / company_id / project_id / session_id`. Hard-coded today; real auth later — but the schema and code paths are tenant-aware from the first commit. **No phase ships without this.**

### P2 · Prediction ledger captures every claim from Phase 0
No strategic claim, recommendation, forecast, war-game outcome, or option score ships without a corresponding entry in the prediction ledger (claim, confidence, framework, model, target horizon, outcome-link). Calibration cannot exist retrospectively — outcomes must be capturable from session one.

### P3 · Tools through MCP, models through router
No domain code calls OpenAI / Anthropic / Google SDK directly. Every model call goes through the LLM router; every tool call goes through the MCP gateway. Provider churn is a `config` change, not a refactor.

### P4 · Diagnosis precedes frameworks
The system reframes the user's question before applying any framework. Framework selection is AI-driven, not a user-facing menu. We resist the consultant-cosplay UX of "pick a framework from the dropdown."

### P5 · Redaction · No-train · Audit · Per-portco export
- PII / secrets / confidential identifiers are redacted at ingestion before any LLM call.
- All provider APIs are enterprise-tier with no-train guarantees.
- Every read of confidential data is audit-logged.
- Per-portco data export is a first-class feature, not a future ask.

These are **Foundation deliverables**, not Phase 7.

### P6 · Phase gates with real usage
A phase only proceeds when the prior phase is used **at least once per week by a real user (you, your team, or a portco)** on real data. Acceptance is not "tests pass" — it is "someone relies on it."

### P7 · Two UX tiers, one backend
- **GP tier**: deep, multi-surface, conversational, voice-rich, portfolio dashboards
- **Operator tier**: voice-first, 1-page memo by default, embedded in their existing tools (Slack / Notion / Linear)
Same backend; UX complexity scales to the user, not collapsed to the lowest common denominator nor exposed in full to time-starved operators.

### P8 · Cost dashboard from day one
Per-user, per-company, per-session token + dollar spend is visible from Phase 0. Soft caps enforced. Cost is a design constraint, not an afterthought.

---

## 2 · Design Heuristics (the "how we decide")

### H1 · Composable primitives, not modes
"Adjacency," "white space," "geo expansion," "M&A," "pricing" — all decompose into the same five primitives (Map firm · Map world · Generate options · Stress-test · Synthesize). Build primitives; orchestrate flexibly. **Never build a "mode" that hard-codes a flow.**

### H2 · Reuse MiroFish before building new
GraphRAG ([graph_builder.py](backend/app/services/graph_builder.py)), OASIS personas ([oasis_profile_generator.py](backend/app/services/oasis_profile_generator.py)), Zep memory, simulation runner — ~60% of the cognition stack is already there. Extension before invention.

### H3 · Borrow Meridian's voice lessons
- WebRTC over WebSocket (echo cancellation)
- Semantic VAD with interrupt_response
- Compact prompt + lookup tools (no 20K-token dumps)
- Static prefix → user-data suffix for prompt caching
- Draft → tray → confirm (never auto-commit from voice)
- Mini-player decoupled from full overlay
- Session lock with TTL + client-side recovery

### H4 · Hierarchical agents, JSON handoffs, hard budgets
- No free-form agent mesh. Chief Strategist dispatches; specialists return structured outputs.
- Every agent has `(token_budget, time_budget, $_budget)`. Hard kill at 1.5× estimate.
- Every step is idempotent and resumable. Restart is a first-class operation.

### H5 · Hot-path distillation early
For high-volume tasks (extraction, classification, intent parsing), use distilled small models behind the same interface as the frontier model. Cost reduction is engineering, not luck.

### H6 · Briefing-style outputs default
1-page memo always. Deeper artifacts on explicit request. Respect operator time.

### H7 · Outcome capture is upstream of features
Every artifact carries `prediction_id`s. Calibration depends on years of data — start now, not later.

### H8 · Memory items are multi-dimensional from creation
Every fact, claim, decision is tagged across {market, segment, product, geo, channel, tech, capability, framework, horizon, confidence, decay class, visibility} at write time. Retrieval flexibility is impossible without this.

### H9 · Confidence + provenance on every claim
No LLM output is presented as fact. Every claim shows confidence and citation. Internal-use too — agents read confidence to weight reasoning.

### H10 · Two-way sync with execution tools
Strategy decomposes to OKRs to tasks to Linear/Jira/Notion/Asana. Execution status flows back. Drift detection is automatic.

### H11 · Learning is a scheduled job, not a hope
Calibration cron, pattern mining cron, consolidation cron, anti-hallucination audit — all running nightly from the phase they're introduced. Intelligence does not compound by accident.

### H12 · Cross-company learning is opt-in raw, auto-distilled
Raw portco facts never cross company boundaries. Anonymized patterns and GP-published playbooks do. Enforced at query layer, not just app layer.

### H13 · External strategies are first-class inputs
The platform must ingest, structure, and *apply* any external strategy artifact (article, playbook, memo, book excerpt, podcast, tweet thread, screenshot) to a chosen portco as a frictionless action. Extracted `StrategyArtifact`s become memory items; applications become predictions; outcomes feed calibration. This is what makes the platform an active reading partner, not a static framework library.

### H14 · UX is calm by default, dense on demand
Every surface starts uncluttered. Density is opt-in via `cmd-shift-D` or equivalent. See [UX_DESIGN.md](./UX_DESIGN.md) for the full design principles (DP1-DP12) — UX decisions cite DPn in PR review, the same way architecture decisions cite Pn/Hn.

---

## 3 · What We Are Deliberately NOT Building

These are real options on the table that we are refusing. Reopening any of them requires a written argument.

- ❌ **A public / community / marketplace product.** Private use only. No social features, no shared library.
- ❌ **A "framework picker" UI.** Frameworks live behind the diagnosis agent.
- ❌ **Generic agentic chat.** This is a strategy platform, not Replika or general assistant.
- ❌ **Real-time data dashboards as primary surface.** Strategy work is asynchronous deliberation, not telemetry.
- ❌ **A consumer SaaS pricing model.** Self-use; no per-seat metering, no billing engine, no marketing site.
- ❌ **Full-fidelity financial modeling (Excel-replacement).** We generate structured models and call code interpreter; we don't build a spreadsheet engine.
- ❌ **A CRM or project-management system.** We integrate with the operator's existing tools; we do not replace them.

---

## 4 · How to Use This Document

- Read it before any architecture debate.
- Cite principle numbers (P1, H7, etc.) when arguing for or against a feature.
- If a proposal violates a principle, the proposal must either be revised or this document must be revised — never silently overridden.
- This document is revised quarterly. Each revision logs what changed and why, in a changelog at the bottom.

---

## 5 · Glossary (terms used precisely)

| Term | Meaning in this project |
|---|---|
| **GP** | The general partner (you) — top-level user, sees everything |
| **Operator** | A team member at the GP firm, scoped to assigned portcos |
| **Portco** | A portfolio company; each has an isolated workspace |
| **Project** | One strategic question / engagement within a portco |
| **Session** | One conversation / brainstorm / work block within a project |
| **Initiative** | A decomposed strategy theme (3-5 per strategy) with OKRs |
| **Memory item** | A single tagged, dated, confidence-scored claim in the knowledge graph |
| **Prediction ledger** | The append-only store of every prediction + its eventual outcome |
| **Playbook** | A procedural memory item — a callable pattern with stage gates |
| **Synergy candidate** | A detected opportunity across two or more portcos |
| **Drift** | Divergence between strategy and execution (schedule / KPI / thesis) |

---

## Changelog

- **v2 · 2026-05-20** — Added H13 (External strategies as first-class inputs — the Share-and-Apply capability) and H14 (UX is calm by default, dense on demand — cross-reference to [UX_DESIGN.md](./UX_DESIGN.md)). Updated North Star to mention the active-reading-partner identity.
- **v1 · 2026-05-20** — Initial document. Codifies principles distilled from holistic design conversation: multi-company self-use, Meridian voice patterns, MiroFish cognition reuse, dimensional memory, calibration ledger, strategy-to-execution bridge, and the eight-perspective debate that produced the final architecture.

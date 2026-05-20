# Strategy Platform

> Private, multi-company strategy platform. Pre-build phase: planning docs are complete, codebase has not yet been scaffolded.

---

## Status

**No code yet.** This repo currently contains only the planning artifacts in [`docs/`](./docs). The codebase will be built next, on Manus AI, deployed on Manus infrastructure.

---

## Quick orient

If you are joining this project (human or AI builder), read in this order:

1. [`docs/GUIDING_PRINCIPLES.md`](./docs/GUIDING_PRINCIPLES.md) — north star + 8 non-negotiables (P1-P8) + 14 heuristics + explicit non-builds
2. [`docs/CLAUDE.md`](./docs/CLAUDE.md) — 25 Critical Patterns (C1-C25) that any coding agent MUST honor
3. [`docs/MASTER.md`](./docs/MASTER.md) — current state, feature status, recent changes
4. [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) — Phase 0-8 with deliverables, acceptance gates, open decisions
5. [`docs/UX_DESIGN.md`](./docs/UX_DESIGN.md) — 12 design principles (DP1-DP12), 13 surfaces, design system
6. [`docs/MEMORY_AND_LEARNING_REVIEW.md`](./docs/MEMORY_AND_LEARNING_REVIEW.md) — robustness audit of the memory + learning subsystems
7. [`docs/DEFERRED_BACKLOG.md`](./docs/DEFERRED_BACKLOG.md) — what's deliberately deferred and why

---

## A note on file-path references in the docs

The docs were originally drafted assuming the platform would extend an upstream open-source project called **MiroFish** (a multi-agent simulation engine). References in CLAUDE.md and IMPLEMENTATION_PLAN.md to specific file paths like `backend/app/services/graph_builder.py` describe **patterns to implement in this new project**, not files in MiroFish to extend.

Treat MiroFish file references as **named pattern targets**: build something that does what the named MiroFish file does, in whatever stack we choose. The MiroFish reference repo is preserved separately at [paigautham-hue/MiroFish](https://github.com/paigautham-hue/MiroFish) (private) if specific code needs to be lifted later.

---

## Stack

**TBD by Manus.** No stack has been pre-committed. The docs are stack-agnostic. The 25 Critical Patterns (CLAUDE.md) apply regardless of stack choice — they describe architectural disciplines (LLM router as single dispatch point, bi-temporal memory, prediction-ledger-on-every-claim, etc.), not languages or frameworks.

The companion project [Meridian](https://github.com/paigautham-hue/meridian) is TypeScript + React + Drizzle + Node — many patterns in CLAUDE.md were adapted from Meridian, so a similar stack would maximize code reuse.

---

## Open decisions (must resolve before Phase 0 starts)

See the table at the end of [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md). Key:

- OD1: Cloud (AWS vs GCP) — likely **Manus infra**
- OD2: DB topology (Postgres + pgvector + AGE, or Postgres + Neo4j)
- OD3: Auth provider (Google Workspace OIDC / Auth0 / WorkOS)
- OD4: LLM router (LiteLLM or custom)
- OD5-OD12: voice / transcription / vision / embeddings / image-gen / on-prem / sandbox / cost SLO / GPU

---

## How to update this README

This README is the project's outermost surface. Update it when:
- The repo gains a working codebase (replace the "no code yet" framing)
- Stack decisions are made (fill in the Stack section)
- A real `Quick Start` becomes possible (add it)
- Deployment URLs exist (add to MASTER.md too)

Follow the **named-file shipping rule** in [`docs/CLAUDE.md`](./docs/CLAUDE.md) — any major change updates `MASTER.md` and the relevant living docs in the same commit.

---

## License

Private. All rights reserved. Not open source. Do not redistribute.

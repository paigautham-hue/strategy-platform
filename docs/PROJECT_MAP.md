# PROJECT_MAP.md — Cairn feature & file map

> **This is the first thing to read before any work, and the first thing to update after it.**
> It is the navigable index of the whole app: every feature, where it lives (route → page →
> tRPC router → service/agent files), and its status. Use it to find code fast and to keep the
> large codebase manageable.
>
> **Companions:** [MASTER.md](./MASTER.md) holds current state + the append-only changelog;
> [CLAUDE.md](./CLAUDE.md) holds the binding conventions (C1–C25) and the stack correction;
> [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) holds phases + acceptance gates;
> [UX_DESIGN.md](./UX_DESIGN.md) holds design principles. This file is the map; those are the territory.

---

## The map protocol (read first, update last)

1. **Before** starting any feature, fix, refactor, or UI change: read this file to locate the
   relevant feature row(s) and the files behind them. Then read [CLAUDE.md](./CLAUDE.md) Critical Patterns.
2. **After** a meaningful change, update — in the **same commit** — every artifact the change touches:
   - this **PROJECT_MAP.md** (add/edit the feature row: files, status, one-liner);
   - the **in-app help** `client/src/lib/manual-content.ts` (a manual entry and/or FAQ item) so users see what changed;
   - [MASTER.md](./MASTER.md) (changelog + Feature Status Matrix), per the named-file rule in CLAUDE.md.
3. Keep status honest: ✅ = code-shipped + unit-tested; 🟡 = partial (a piece is gated on deploy,
   data, an external API, or GPU); ☐ = not built. Acceptance-gate status (real usage) lives in
   MASTER's Phase Status table, not here.

---

## App identity

- **Product:** Cairn — a private, multi-company AI strategy platform (an investor + their portfolio companies). Built on the MiroFish multi-agent engine.
- **Live:** deployed on Manus (`https://stratplat-ublkz3ci.manus.space`). ADR-010: Claude pushes code → Manus deploys and runs DB migrations on publish.
- **Stack (real):** TypeScript end-to-end. React 19 + Vite + Tailwind 4 + shadcn/ui client; Express 4 + tRPC v11 server; Drizzle ORM on MySQL/TiDB; app-side cosine/RRF/MMR retrieval; pnpm. (⚠️ The prose in CLAUDE.md/IMPLEMENTATION_PLAN that mentions Python/FastAPI/Vue is the original plan, not the build — see the CLAUDE.md Stack Correction.)
- **Non-negotiables you will meet everywhere:** multi-company namespacing on every row (C1); all LLM/embedding calls through `server/ai/router.ts` (C3) which redacts (C5) + budgets (C7) + logs cost; every shipped claim in the prediction ledger (C2); bi-temporal memory, never destructive (C19); deterministic verdicts computed from model output, never asserted by the model.

## Repo layout

```
client/src/
  pages/*.tsx          one file per surface (route → page)
  components/          PlatformLayout (sidebar nav + role gating), ui/* (shadcn)
  lib/                 trpc.ts (client), manual-content.ts (in-app help DATA — update on changes)
server/
  routers.ts           ALL tRPC routers + appRouter (the API surface)
  ai/                  router.ts (LLM choke-point), mcp-gateway.ts, budget.ts, redactor.ts, models.yaml
  agents/*.ts          one LLM-backed reasoning module each (diagnosis, research, war-game, …)
  services/*.ts        domain services (memory, calibration, kpi-library, monte-carlo, …)
  connectors/          execution-tool clients (Linear live; Notion/Jira stubs) + crypto
  retrieval/ ingest/ extraction/ memory/ causal/   pipelines & math
  cron/                backup, memory-hygiene, memory-reflection, handlers
  middleware/audit.ts  audit log + usage events
drizzle/schema.ts      all tables (21) + enums; migrations 0000–0003
docs/                  this map + MASTER + CLAUDE + IMPLEMENTATION_PLAN + UX_DESIGN + ADRS + RUNBOOK + …
```

---

## Feature map

Each row: **Feature** · route · client page · tRPC router · key server file(s) · status · what it does.
🆕 marks the modules salvaged from the StrategyForge/Dynamo prototypes (June 2026).

### Companies & workspace
| Feature | Route | Page | Router | Server files | Status | Notes |
|---|---|---|---|---|---|---|
| Overview | `/` | Overview | (company, cost, memory) | — | ✅ | At-a-glance health for the active company + platform |
| Companies | `/companies` | Companies | `company` | services/access.ts | ✅ | List/create portcos |
| Onboard Company | `/onboarding` | Onboarding | `company`,`ingest` | services/ingest-pipeline.ts | ✅ | Wizard: create → seed memory → ingest (operator+) |
| Projects | `/projects` | Projects | `project` | — | ✅ | Strategy projects within a company |

### Knowledge & memory
| Feature | Route | Page | Router | Server files | Status | Notes |
|---|---|---|---|---|---|---|
| Memory | `/memory` | Memory | `memory` | services/memory.ts, memory-search.ts, memory-layers.ts, retrieval/* | ✅ | Bi-temporal claim store + hybrid retrieval |
| Connections | `/connections` | EntityGraph | `entityGraph` | services/entity-graph.ts, retrieval/graph.ts | ✅ | Multi-hop entity graph (HippoRAG) |
| Ingest | `/ingest` | Ingest | `ingest` | services/ingest-pipeline.ts, ingest/*, extraction/* | 🟡 | text/md/html/url/PDF/DOCX live; audio/video/image pending |
| Voice Intake | `/voice-intake` | VoiceIntake | `voice` | services/voice-intent.ts, _core/voiceTranscription.ts | ✅ | One-shot STT → intent parse |

### Strategy intake
| Feature | Route | Page | Router | Server files | Status | Notes |
|---|---|---|---|---|---|---|
| 🆕 Discovery (Digital Twin) | `/discovery` | Discovery | `digitalTwin` | services/digital-twin.ts, digital-twin-store.ts; agents/digital-twin-interview.ts | ✅ | Dimension-steered interview; graded coverage; funnel gates; capture + strategy synthesis (salvaged Dynamo) |
| Brainstorm | `/brainstorm` | Brainstorm | `brainstorm` | agents/brainstorm.ts | ✅ | 4-phase brainstorm, 5 silent extractors |
| Memo Dictation | `/memo` | MemoDictation | `memo` | agents/memo-dictation.ts | ✅ | Monologue → 1-page memo |
| Advisory Personas | `/personas` | Personas | `persona` | agents/personas.ts | ✅ | Coach/Challenger/Devil's-Advocate/etc. |
| Strategy Artifacts | `/strategy-artifacts` | StrategyArtifact | `strategyArtifact` | services/strategy-artifact.ts; agents/apply-strategy.ts, apply-war-game.ts | ✅ | Share-and-Apply external strategy → portco |

### Reasoning
| Feature | Route | Page | Router | Server files | Status | Notes |
|---|---|---|---|---|---|---|
| Diagnose | `/diagnose` | Diagnosis | `diagnosis` | agents/diagnosis.ts | ✅ | Reframe + classify before frameworks (P4) |
| Research | `/research` | Research | `research` | agents/research.ts | ✅ | Chief Strategist + 8 specialists, memory-grounded |
| Contradictions | `/contradictions` | Contradictions | `contradiction` | services/contradictions.ts | ✅ | Find + resolve conflicting beliefs |
| Frameworks | `/frameworks` | Frameworks | `frameworks` | agents/frameworks.ts | ✅ | 8-framework library, diagnosis-selected |
| Diagrams | `/diagrams` | Diagrams | `diagram` | agents/diagram.ts | 🟡 | Porter/SWOT/3H CSS specs; raster export gated |
| Options | `/options` | Options | `options` | agents/options.ts | ✅ | Option generation + MCDA scoring |
| Red Team | `/red-team` | RedTeam | `redTeam` | agents/red-team.ts | ✅ | 5 hostile personas; computed verdict |

### Simulation
| Feature | Route | Page | Router | Server files | Status | Notes |
|---|---|---|---|---|---|---|
| War-Game | `/war-game` | WarGame | `warGame` | agents/war-game.ts | ✅ | 4-arena multi-round; synthetic outcomes to ledger |
| Cross-Co War-Game | `/cross-war-game` | CrossCoWarGame | `warGame` | agents/cross-co-war-game.ts | ✅ | GP-only, one shock across portcos |
| 🆕 Financial Simulation | `/simulation` | Simulation | `simulation`,`currency` | services/monte-carlo.ts, currency.ts | ✅ | Monte Carlo NPV/IRR/VaR/CVaR/Sharpe + sensitivity + scenarios; dual USD/₹-Cr (salvaged StrategyForge) |

### Strategy → execution
| Feature | Route | Page | Router | Server files | Status | Notes |
|---|---|---|---|---|---|---|
| Decompose | `/decompose` | Decomposer | `decomposer` | agents/decomposer.ts | ✅ | Thesis → initiatives → OKRs → tasks |
| Pre-Mortem | `/pre-mortem` | PreMortem | `decomposer` | agents/pre-mortem.ts | ✅ | Failure-first risk register before launch |
| Drift Detection | `/drift` | Drift | `drift` | agents/drift.ts | ✅ | Schedule/KPI/thesis drift + replan |
| KPI Library | `/kpi-library` | KpiLibrary | `kpi` | services/kpi-library.ts | ✅ | 15 standard operating KPIs (pure compute) |
| 🆕 Strategic Tracker | `/strategy-management` | StrategyManagement | `strategyManagement` | services/strategy-management.ts; agents/strategic-extract.ts | ✅ | Generate + track KPIs/milestones/risks (operator+; salvaged StrategyForge) |

### Learning loop
| Feature | Route | Page | Router | Server files | Status | Notes |
|---|---|---|---|---|---|---|
| Predictions | `/predictions` | Predictions | `prediction` | services/predictions.ts | ✅ | The prediction ledger |
| Calibration | `/calibration` | Calibration | `calibration` | services/calibration.ts | 🟡 | Brier/Murphy scorecard; needs closed real predictions |
| Attribution | `/attribution` | Attribution | `attribution` | agents/attribution.ts, causal/confounder-dags.ts | ✅ | Causal-lite, DAG-conditioned |
| Constitutional Audit | `/compliance` | Compliance | `compliance` | services/audit-constitution.ts | ✅ | Anti-hallucination principle audit |
| Playbooks | `/playbooks` | Playbooks | `playbook` | agents/playbook.ts | ✅ | Promotion-gated reusable plays |
| Pattern Mining | `/patterns` | PatternMining | `pattern` | agents/pattern-mining.ts | ✅ | Recurring decision structures |

### Portfolio intelligence (GP-only)
| Feature | Route | Page | Router | Server files | Status | Notes |
|---|---|---|---|---|---|---|
| Synergy Scout | `/synergy` | SynergyScout | `synergy` | agents/synergy-scout.ts | ✅ | 9-axis cross-portfolio synergies (audited) |
| Pattern Distillation | `/distillation` | Distillation | `distillation` | services/distillation.ts | ✅ | Anonymised, N≥3 publication gate |
| Briefing | `/briefing` | Briefing | `briefing` | agents/briefing.ts | 🟡 | Daily/weekly text briefing; TTS audio pending |

### Operations, cost & access
| Feature | Route | Page | Router | Server files | Status | Notes |
|---|---|---|---|---|---|---|
| Cost Dashboard | `/cost` | CostDashboard | `cost` | drizzle llm_call_log | ✅ | GP+; spend by company/user |
| Audit Log | `/audit` | AuditLog | `audit` | middleware/audit.ts | ✅ | Append-only confidential read/write trail (operator+) |
| Usage Events | `/usage` | UsageEvents | `audit` | middleware/audit.ts | ✅ | Telemetry of surface usage (operator+) |
| Export | `/export` | ExportPage | `export` | services/export.ts | ✅ | GP-only per-company encrypted export |
| Connectors | `/connectors` | Connectors | `connector` | connectors/index.ts, linear.ts, crypto.ts | 🟡 | Linear live; Notion/Jira stubs (operator+) |
| MCP Tools | `/mcp` | McpTools | `mcp` | ai/mcp-gateway.ts | ✅ | 4 dispatchable tools (web_search/web_fetch/edgar_filings/lookup_memory) |
| User Manual & FAQ | `/manual` | Manual | — | lib/manual-content.ts | ✅ | In-app help — **update on every feature change** |
| User Management | `/users` | Users | `user` | services/access.ts | ✅ | Admin-only roles + per-company access |

---

## Cross-cutting systems (no single page)

| System | Files | Notes |
|---|---|---|
| LLM router (choke-point) | `server/ai/router.ts` + budget.ts, redactor.ts, models-config.ts, models.yaml | The ONLY place LLM/embedding calls happen (C3). Redaction (C5) + budget (C7) + cost log + AJV structured validation. |
| MCP gateway | `server/ai/mcp-gateway.ts` | The ONLY place tools are dispatched (C3). |
| Memory engine | `server/services/memory*.ts`, `retrieval/{cosine,rrf,mmr,graph}.ts` | Bi-temporal, dimensional, hybrid retrieval (C19–C24). |
| Prediction ledger | `server/services/predictions.ts`, drizzle `prediction`/`outcome` | Every shipped claim recorded (C2); real vs synthetic strata (C25). |
| Ontology | `shared/ontology.ts` | 15 entities / 9 relations with edge validation. |
| Crons | `server/cron/{backup,memory-hygiene,memory-reflection,handlers}.ts` | Manus invokes via authenticated cron endpoints (see CRON_REGISTRY.md). |
| Cost/perf | `server/services/cache.ts`, `prompt-compression.ts` | Embedding cache + lossless prompt compression (Phase 8). |
| Tenancy & audit | every service + `server/middleware/audit.ts` | C1 on every row; cross-company reads audited. |

---

## Known gaps / roadmap (buildable but not yet built)

- **Real PDF/DOCX extraction hardening** — `mammoth` + `pdfjs-dist` are dependencies and ingest lists PDF/DOCX as live; verify/strengthen the extraction path (this is Cairn's own pipeline, NOT the StrategyForge stub, which was deliberately not ported).
- **Notion / Jira connectors** — currently `available:false` stubs; implement to the Linear standard (`server/connectors/`).
- **Live FX rate** — `currency.ts` uses an injected fallback; add an `fx_rate` MCP tool (C3) for live rates.
- **External KPI sync** (Stripe/GA4/Salesforce) — the KPI library exists; live connectors do not.
- **Realtime WebRTC voice + TTS**, **vision-in ingest**, **live deep-research streaming UI** — see MASTER Feature Matrix (☐ rows).
- Acceptance-gate items (real weekly usage, ≥20 closed real predictions, ≥3 onboarded portcos) are usage/data milestones, not code — tracked in MASTER Phase Status.

---

## Change log for this file

- **2026-06-30** — Created. Full feature map of all surfaces + cross-cutting systems; documented the read-before / update-after protocol and wired it into CLAUDE.md. Salvaged modules (Discovery, Financial Simulation, Strategic Tracker) included.

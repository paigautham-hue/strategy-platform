# Strategy Platform (Cairn) — QA Audit Report

**Date:** 2026-07-08  
**Branch:** `main` @ `807b58d` (matches `origin/main`)  
**Repo:** strategy-platform  
**Audience:** Claude Code / developers fixing bugs  

---

## Executive summary

Automated checks pass (type-check, 573 tests, build), but a manual/code audit found **real bugs** in:

1. **Security** — raw API key can reach the browser; weak export crypto  
2. **Tenancy (C1)** — company access not enforced on most tRPC routes; memory IDORs  
3. **Prediction ledger (C2)** — agent claims ship without ledger entries; errors swallowed  
4. **Frontend UX** — onboarding dead-ends, stale history, blank `/history` page  

**Recommended fix order:** B1 → H1/H2/H3 → C1/C2 → redaction/audit → frontend UX.

---

## Automated QA results

| Check | Command | Result |
|-------|---------|--------|
| Type-check | `pnpm check` | PASS |
| Tests | `pnpm test` | PASS — 573 passed, 16 skipped (54 files) |
| Build | `pnpm build` | PASS |

---

## BLOCKER

### B1 — Raw Gemini API key shipped to browser

| Field | Detail |
|-------|--------|
| **Severity** | Blocker |
| **Symptom** | When ephemeral token minting fails, server returns full `GOOGLE_GEMINI_API_KEY` to client (`authMethod: "raw"`). Client connects via WebSocket `?key=`. |
| **Evidence** | `server/_core/geminiRealtime.ts:228-238`, `client/src/lib/geminiLiveEngine.ts:102-105`, `client/src/lib/geminiLiveEngine.ts:602-603` |
| **Fix** | Remove raw-key fallback. Fail session (503) if mint fails. Never send raw key to browser. |

---

## CRITICAL / HIGH — Security & tenancy

### H1 — Company access not enforced on most tRPC procedures

| Field | Detail |
|-------|--------|
| **Severity** | Major |
| **Symptom** | `portco_team` / scoped `operator` with `assignedCompanyIds` can read/write another company's data by passing a different `companyId`. `company.list` filters correctly; most other routes do not. SSE research stream enforces access; tRPC largely does not. |
| **Evidence** | `server/services/access.ts:43-50`; enforced in `server/_core/researchStream.ts:38-40`; missing in `server/routers.ts` e.g. `company.get` (~214), `memory.write`/`memory.query` (~334-370), `prediction.list` (~471), `ingest.document` (~672), `research.run` (~777), `mcp.dispatch` (~651). Only ~20 call sites use `assertCompanyAccess` / `assertCompanyAccessible` in routers. |
| **Fix** | Shared tRPC middleware or `assertCompanyAccessible(ctx, companyId)` on every procedure accepting `companyId`. Mirror `researchStream.ts`. |

### H2 — `memory.supersede` IDOR

| Field | Detail |
|-------|--------|
| **Severity** | Major |
| **Symptom** | `oldItemId` invalidated without verifying tenant/company ownership. User with access to company A can retire company B's memory if they know the ID. |
| **Evidence** | `server/routers.ts:383-391` (no access check); `server/services/memory.ts:309-312` (UPDATE only `WHERE id = oldItemId`) |
| **Fix** | Load old item with `tenantId` + `companyId`; reject if missing. Add `assertCompanyAccessible` at router. |

### H3 — `memory.deleteItem` company mismatch

| Field | Detail |
|-------|--------|
| **Severity** | Major |
| **Symptom** | Router checks `input.companyId`, but `purgeMemoryItem` deletes by `itemId` + `tenantId` only. |
| **Evidence** | `server/routers.ts:400-405`; `server/services/memory.ts:367-376` |
| **Fix** | Require `item.companyId === input.companyId` before delete. |

### H4 — Voice realtime bypasses redaction (C5)

| Field | Detail |
|-------|--------|
| **Severity** | Major |
| **Symptom** | Company description and confidential memory/prediction payloads sent to OpenAI/Gemini without `redact()`. |
| **Evidence** | `server/_core/realtime.ts:88-101`; `server/routers.ts:906-922` (`lookup_memory`); `server/routers.ts:924-948` (`lookup_predictions`) |
| **Fix** | Run `redact()` on system prompt and tool results before returning to client/provider. Audit confidential reads. |

### H5 — `vision.generate` bypasses redaction

| Field | Detail |
|-------|--------|
| **Severity** | Major |
| **Symptom** | User prompts go straight to image API with no `redact()` pass. |
| **Evidence** | `server/routers.ts:1911-1913`; `server/agents/vision.ts:89-93`; `server/_core/imageGeneration.ts:61-64` |
| **Fix** | Redact prompts before image generation; enforce budget/logging like other LLM calls. |

### H6 — MCP `lookup_memory` — no audit log (C6)

| Field | Detail |
|-------|--------|
| **Severity** | Major |
| **Symptom** | MCP memory reads have no `appendAudit`. Hybrid search does audit. |
| **Evidence** | `server/ai/mcp-gateway.ts:126-162` vs `server/services/memory-search.ts:167-177` |
| **Fix** | Add audit on MCP confidential reads. |

### H7 — Prediction reads lack audit logging

| Field | Detail |
|-------|--------|
| **Severity** | Major |
| **Symptom** | List/open/calibration endpoints return confidential claims without audit. |
| **Evidence** | `server/services/predictions.ts:213-237`, `284-307`; `server/routers.ts:471-473`, `526-528`, `1298-1305` |
| **Fix** | Audit confidential-tier reads at router or service boundary. |

### H8 — Global memory layer not role-gated

| Field | Detail |
|-------|--------|
| **Severity** | Major |
| **Symptom** | Any authenticated user can write/query tenant-global framework canon via `memory.writeLayer` / `memory.queryLayer`. `distillation.publish` is GP-only. |
| **Evidence** | `server/routers.ts:431-463`; `server/services/memory-layers.ts:95-133` |
| **Fix** | Gate `writeLayer` with `gpProcedure`; restrict global `queryLayer` to GP+. |

### H9 — Export encryption is reversible XOR

| Field | Detail |
|-------|--------|
| **Severity** | Major |
| **Symptom** | XOR with predictable key (`JWT_SECRET` + `companyId`). Not suitable for confidential archives. |
| **Evidence** | `server/services/export.ts:108-116` |
| **Fix** | AES-256-GCM + proper key management; block GP export in prod until fixed. |

---

## CRITICAL / HIGH — Prediction ledger (C2)

### C1 — Agent outputs not recorded in ledger

| Field | Detail |
|-------|--------|
| **Severity** | Critical |
| **Symptom** | Diagnosis, research, frameworks, options, red-team, persona, etc. call `persistAnalysisRun` but not `recordPrediction`. Calibration cannot work. |
| **Evidence** | Contract: `server/services/predictions.ts:4-5`. Routers: `server/routers.ts:766-791`, `1004-1042`, `1213-1247`. Only war-game paths call `recordPrediction` (~1060-1143, ~720-737). |
| **Fix** | After each agent: `extractClaims` + `recordPrediction` per claim in same transaction as result persistence. |

### C2 — Ledger write failures swallowed

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Symptom** | Empty `catch {}` on war-game ledger writes — user gets result, ledger gap is silent. |
| **Evidence** | `server/routers.ts:735-737`, `1073-1075`, `1141-1143` |
| **Fix** | Remove empty catches. Fail mutation or return explicit `ledgerWarning` + log. |

### C3 — `closePrediction` / `resolvePrediction` race

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Symptom** | Concurrent closes can insert multiple `outcome` rows. No transaction / unique on `predictionId`. |
| **Evidence** | `server/services/predictions.ts:112-143`; `drizzle/schema.ts:255-265` |
| **Fix** | Transaction + `SELECT FOR UPDATE`; `UNIQUE(outcome.predictionId)`. |

---

## HIGH — Idempotency & memory integrity

### H10 — `writeMemory` idempotency key not enforced

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Symptom** | Retries create duplicate rows; key generated if absent, no lookup before insert. |
| **Evidence** | `server/services/memory.ts:114`, `149-179`; unique on idempotency in `drizzle/schema.ts:~202` |
| **Fix** | SELECT by `(tenantId, companyId, idempotencyKey)` first; return existing on hit. |

### H11 — `supersedeMemory` silent bi-temporal break

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Symptom** | Wrong `oldItemId` still inserts new item; old row never invalidated. |
| **Evidence** | `server/services/memory.ts:308-312`; router `server/routers.ts:383-391` |
| **Fix** | Validate old row exists in scope; fail if UPDATE affects 0 rows. |

### H12 — Daily budget cap bypass

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Symptom** | 60s spend cache not updated after calls; parallel research agents each pass per-call budget. |
| **Evidence** | `server/ai/router.ts:162-165`, `177`; `server/agents/research.ts:302-309` |
| **Fix** | Increment cache after each log; per-user lock or atomic reserve before parallel dispatch. |

### H13 — Red-team returns `survivedReview: true` on LLM failure

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Symptom** | On structured-call failure, strategy appears cleared. |
| **Evidence** | `server/agents/red-team.ts:218-225` |
| **Fix** | Return `survivedReview: false` + `failed: true` on catch. |

---

## HIGH — Frontend UX

### F1 — Onboarding dead-end

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Symptom** | Overview "Get started" steps 2–3 link to `/ingest` and `/diagnose` when `companies.length === 0`. Those pages require `activeCompanyId` and show dead-end. |
| **Evidence** | `client/src/pages/Overview.tsx:209-235`; `client/src/pages/Ingest.tsx:82-88`; `client/src/pages/Diagnosis.tsx:42-48` |
| **Fix** | Gate steps 2–3 until company exists; link to `/onboarding` only. |

### F2 — Analysis history never refreshes

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Symptom** | After playbook/persona/pattern-mining success, "Saved playbooks" / "Past consultations" stay empty until remount. |
| **Evidence** | No `analysisRuns.list.invalidate` in `client/`; `client/src/pages/Playbooks.tsx`, `Personas.tsx`, `PatternMining.tsx`; `client/src/components/AnalysisHistory.tsx` |
| **Fix** | `utils.analysisRuns.list.invalidate({ companyId, kind })` on mutation `onSuccess`. |

### F3 — `/history` blank when empty or loading

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Symptom** | No skeleton, no "no runs yet" — component returns `null`. |
| **Evidence** | `client/src/components/AnalysisHistory.tsx:165` |
| **Fix** | Skeleton while loading; empty state when `runs.length === 0`; error card on `isError`. |

---

## MEDIUM — Frontend

| ID | Issue | Evidence | Fix |
|----|-------|----------|-----|
| F4 | Query errors shown as empty data | `Contradictions.tsx:59-69`, `AuditLog.tsx`, `UsageEvents.tsx`, `Calibration.tsx`, `Users.tsx` | Branch on `isError` before empty states |
| F5 | Distillation: can't publish second pattern in session | `Distillation.tsx:135` (`publishMut.isSuccess` disables button) | Reset `publishMut` when pattern text changes |
| F6 | Distillation: preview vs publish mismatch | `Distillation.tsx:67-72` vs `132-149` | Clear preview on edit or require re-preview |
| F7 | Cross-Co War-Game allows >6 companies | `CrossCoWarGame.tsx:109-114` vs `routers.ts:1087` (`max(6)`) | Cap selection at 6 in UI |
| F8 | Pattern→Playbook toast nested `<a>` | `PatternMining.tsx:39-42` | Use `navigate("/playbooks")` or single Link |
| F9 | `auth.me` error shows login screen | `useAuth.ts:44-54`, `App.tsx:70-127` | Show retry/error when `isError` && not UNAUTHORIZED |
| F10 | GP-only routes reachable by URL | `Distillation`, `Export`, `Synergy` — no page gate | Add `GpGate` wrapper like `Portfolio.tsx` |

---

## MEDIUM — Backend (additional)

| ID | Issue | Evidence |
|----|-------|----------|
| M1 | `extractClaims` returns `[]` on LLM failure | `server/services/predictions.ts:200-201` |
| M2 | Daily cap fails open on DB error | `server/ai/router.ts:178-181` |
| M3 | Image gen bypasses budget router | `server/agents/vision.ts`, `server/routers.ts:1911` |
| M4 | `resolveContradiction` not idempotent | `server/services/contradictions.ts:147-185` |
| M5 | Layer container race (duplicate `__global__`) | `server/services/memory-layers.ts:69-88` |
| M6 | Memory reflection cron duplicates nightly | `server/cron/memory-reflection.ts:183-195` |
| M7 | `writeStrategicItems` duplicates on retry | `server/services/strategy-management.ts:300-308` |

---

## LOW

| ID | Issue | Evidence |
|----|-------|----------|
| L1 | `NotFound` light theme in dark shell | `client/src/pages/NotFound.tsx` |
| L2 | Voice button silent no-op with stale company ID | `PlatformLayout.tsx:145-151` |
| L3 | Memory purge count understates (limit 50) | `Memory.tsx:118-121`, `167` |
| L4 | `user.assignCompanies` doesn't validate company IDs | `server/routers.ts:1648-1655` |
| L5 | `analysisRuns.list` no audit on confidential output | `server/services/analysis-runs.ts:55-81` |

---

## What looks solid

- TypeScript, 573 unit tests, and production build all pass
- Primitives exist: `access.ts`, `assertCompanyAccessible`, `appendAudit`, `redact`
- `researchStream.ts` is the reference pattern for company scoping
- Most pages guard `!activeCompanyId`
- MCP schema hints, memory purge, drag-drop ingest implemented

---

## Suggested fix order for Claude Code

```
1. B1  — Remove Gemini raw-key browser fallback
2. H1  — assertCompanyAccessible on all companyId procedures
3. H2, H3 — Fix memory supersede/delete IDORs
4. C1, C2 — Wire recordPrediction; stop swallowing ledger errors
5. H10, H11 — Memory idempotency + supersede validation
6. H4, H5, H6, H7 — Redaction + audit on voice/vision/MCP/predictions
7. F1, F2, F3 — Onboarding + history UX
8. Remaining medium/low items
```

---

## How to use this report

Paste this file path or contents into Claude Code:

```
Please fix the bugs in docs/QA_AUDIT_REPORT_2026-07-08.md starting with Blocker B1, then H1-H3, then C1-C2.
```

Or attach the file: `docs/QA_AUDIT_REPORT_2026-07-08.md`

---

*Generated by Cloud Agent QA audit — 2026-07-08*

# Operations Runbook

> IMPLEMENTATION_PLAN.md Phase 8, Workstreams 8.4 + 8.5 — the on-call runbook,
> SLO definitions, deploy procedure, and disaster-recovery drill. Keep this
> current; an out-of-date runbook is worse than none.

---

## 1. Service Level Objectives (8.5)

| Surface | Metric | Target (P95) |
|---|---|---|
| Research session | end-to-end completion | ≤ 90 s |
| Voice turn (realtime) | response start | ≤ 1 s |
| Brainstorm | draft-tray render after extract | ≤ 2 s |
| Execution-tool sync | round-trip | ≤ 5 min |
| Structured agent call | completion | ≤ 20 s |
| Page load (web) | first contentful paint | ≤ 2 s |

**Cost SLO.** Per-tenant LLM spend is bounded by the budget envelope enforced
in `server/ai/budget.ts`. Review weekly (CC2).

---

## 2. Deploy procedure

The build/deploy split is fixed (ADR-010):

1. Claude Code writes the change, runs `pnpm check && pnpm test && pnpm build`,
   commits, and pushes to `main` on `paigautham-hue/strategy-platform`.
2. Manus pulls `main` and publishes to Manus infrastructure.
3. On first deploy and after any schema change, run the Drizzle migration
   (`drizzle-kit push`) against the MySQL instance.
4. Smoke-test the synthetic checks (section 5) before declaring the deploy good.

**Rollback.** Re-publish the previous green commit. The database is
forward-compatible within a release; a schema migration that must be reverted
requires a paired down-migration — write one before shipping a destructive
schema change.

---

## 3. Required environment variables (Manus Vault → runtime env)

Secrets live in the Manus Vault and are injected as environment variables.
None are committed.

| Variable | Purpose | Required for |
|---|---|---|
| `DATABASE_URL` | MySQL connection string | All persistence |
| `OPENAI_API_KEY` | Embeddings (text-embedding-3-small) | Memory, search |
| LLM / forge API key | Completion + structured calls | All reasoning |
| `LINEAR_API_KEY` etc. | Execution-tool connectors | Phase 5.2 (when built) |
| `STRIPE_API_KEY`, `GA4_*` | KPI sync | Phase 5.3 (when built) |
| `ELEVENLABS_API_KEY` | TTS audio digest | Phase 4/7 voice (when built) |

Without `DATABASE_URL` the app runs but persistence is disabled (`getDb()`
returns null and callers degrade gracefully). Without `OPENAI_API_KEY` the
embedding path throws — memory ingest and search are unavailable.

---

## 4. Scheduled jobs (cron)

Configure on the Manus scheduler:

| Job | Cadence | Module |
|---|---|---|
| Memory hygiene (decay + dedup) | nightly | `server/cron/memory-hygiene.ts` |
| Memory reflection | nightly | `server/cron/memory-reflection.ts` |
| Nightly telemetry rollup | nightly | `runNightlyTelemetry` |

When the outcome-resolver and calibration crons ship (Phase 6 cron tier), add
them here.

---

## 5. Synthetic checks (8.5)

Run after every deploy and on a 5-minute monitor:

1. **Auth** — `auth.me` returns the session user.
2. **Persistence** — `company.list` returns without error.
3. **Reasoning** — `diagnosis.diagnose` on a fixture question returns a
   structured result.
4. **Memory** — ingest a fixture document, then `memory` search returns it.
5. **Embedding cache** — a repeated embed call returns `cached: true`.

A failed synthetic check pages on-call.

---

## 6. Common incidents

| Symptom | Likely cause | First action |
|---|---|---|
| All reasoning calls fail | LLM API key invalid / quota | Check Vault key; check provider status |
| Embeddings fail, reasoning OK | `OPENAI_API_KEY` invalid | Rotate the key in Vault, re-publish |
| Budget-exceeded errors spike | A tenant hit its envelope | Review `llm_call_log`; raise envelope or investigate a loop |
| Persistence errors | `DATABASE_URL` / MySQL down | Check MySQL health; check connection string |
| Slow research sessions | Provider latency or no model fallback | Check provider; confirm a backup model is configured (CC3) |
| Cross-company data appears for a non-GP | Permission regression | Page immediately — this is a P1; audit `audit_log` |

**P1 (data isolation breach):** treat any cross-tenant or unauthorised
cross-company data exposure as a Sev-1. Take the surface offline, audit the
`audit_log` for scope, and notify before any other remediation.

---

## 7. Disaster recovery

**Backups.** MySQL automated daily snapshots (Manus-managed). Verify the
snapshot schedule is active per environment.

**Restore drill (run quarterly).**
1. Provision a scratch MySQL instance.
2. Restore the most recent snapshot into it.
3. Point a staging deploy at the scratch instance.
4. Run the section-5 synthetic checks against staging.
5. Confirm the prediction ledger and audit log are intact and complete.
6. Record the drill outcome and the wall-clock restore time.

**RPO / RTO targets.** RPO ≤ 24 h (daily snapshot). RTO ≤ 2 h (provision +
restore + verify).

---

## 8. Cross-cutting hygiene (continuous)

| Cadence | Task |
|---|---|
| Weekly | Cost review; review newly closed predictions |
| Monthly | Per-tenant budget reset; framework/model leaderboard; access audit |
| Quarterly | Security review; secret rotation; model price benchmarking; DR drill; provider-failover drill (disable primary, run on backup) |

# Cron Registry

Registered heartbeat jobs for Strategy Platform Phase 0.
These crons are managed by the Manus platform and survive sandbox hibernation.

| Name | Task UID | Schedule (6-field UTC) | Path | Description |
|---|---|---|---|---|
| `daily-backup` | `TA2KCxGusGy57kq2m5fPqN` | `0 0 2 * * *` (02:00 UTC) | `/api/scheduled/daily-backup` | Export all companies to encrypted archives in Manus S3 |
| `nightly-telemetry` | `5v9m6wWRFCh9zmVAkawEwN` | `0 0 3 * * *` (03:00 UTC) | `/api/scheduled/nightly-telemetry` | Aggregate LLM call logs into daily usage summaries |

## Management

To inspect, pause, resume, or view logs for these crons:

```bash
# List all crons
manus-heartbeat list

# View recent execution logs for daily-backup
manus-heartbeat logs --task-uid TA2KCxGusGy57kq2m5fPqN

# Pause nightly-telemetry
manus-heartbeat update --task-uid 5v9m6wWRFCh9zmVAkawEwN --enable false

# Resume nightly-telemetry
manus-heartbeat update --task-uid 5v9m6wWRFCh9zmVAkawEwN --enable true
```

The Manus dashboard (Settings → Schedules) also surfaces all crons with execution history and Run Now.

> **Note:** The site must be deployed before crons can fire. Crons POST to the production URL;
> the dev sandbox is unreachable from the Manus cron infrastructure.

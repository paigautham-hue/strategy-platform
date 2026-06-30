/**
 * Heartbeat handlers for scheduled cron jobs.
 * Mounted in server/_core/index.ts before the Vite fallthrough.
 *
 * Routes:
 *   POST /api/scheduled/daily-backup
 *   POST /api/scheduled/nightly-telemetry
 */

import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { runDailyBackup } from "./backup";
import { runNightlyTelemetry } from "./backup";
import { runCalibrationSnapshot } from "./calibration-snapshot";

export async function dailyBackupHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    console.log(`[cron] daily-backup triggered by task ${user.taskUid}`);
    const result = await runDailyBackup();

    return res.json({
      ok: true,
      taskUid: user.taskUid,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[cron] daily-backup error:", message);
    return res.status(500).json({
      error: message,
      stack,
      context: { url: req.url, taskUid: "unknown" },
      timestamp: new Date().toISOString(),
    });
  }
}

export async function nightlyTelemetryHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    console.log(`[cron] nightly-telemetry triggered by task ${user.taskUid}`);
    const result = await runNightlyTelemetry();

    return res.json({
      ok: true,
      taskUid: user.taskUid,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[cron] nightly-telemetry error:", message);
    return res.status(500).json({
      error: message,
      stack,
      context: { url: req.url, taskUid: "unknown" },
      timestamp: new Date().toISOString(),
    });
  }
}

export async function calibrationSnapshotHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    console.log(`[cron] calibration-snapshot triggered by task ${user.taskUid}`);
    const result = await runCalibrationSnapshot();

    return res.json({
      ok: true,
      taskUid: user.taskUid,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[cron] calibration-snapshot error:", message);
    return res.status(500).json({
      error: message,
      stack,
      context: { url: req.url, taskUid: "unknown" },
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Async ingest jobs — large documents can't run inside one HTTP request.
 *
 * A 40-page report is ~50-100 chunks × several LLM calls each; the synchronous
 * `ingest.document` mutation held the connection open for minutes and the
 * hosting proxy returned an HTML 504 page (the client saw "Unexpected token
 * '<' … is not valid JSON"). Instead, `ingest.start` registers a job here,
 * kicks the pipeline off in the background, and returns immediately; the
 * client polls `ingest.status` for live chunk progress and the final result.
 *
 * In-process registry (single-instance deploy): jobs are pruned after 1 hour.
 * A server restart loses in-flight jobs — the client surfaces that as a
 * "job not found" error and the user simply re-runs the ingest.
 */

import { nanoid } from "nanoid";
import { ingestDocument, type IngestDocumentInput, type IngestDocumentResult } from "./ingest-pipeline";

export interface IngestJob {
  id: string;
  tenantId: string;
  userId: number;
  companyId: number;
  status: "running" | "complete" | "error";
  progress: { processed: number; total: number };
  result?: IngestDocumentResult;
  error?: string;
  startedAt: number;
}

const jobs = new Map<string, IngestJob>();
const JOB_TTL_MS = 60 * 60 * 1000;

function pruneOldJobs() {
  const cutoff = Date.now() - JOB_TTL_MS;
  jobs.forEach((job, id) => {
    if (job.startedAt < cutoff) jobs.delete(id);
  });
}

/** Register and launch an ingest job. Returns the job id immediately. */
export function startIngestJob(input: IngestDocumentInput): string {
  pruneOldJobs();
  const id = nanoid(16);
  const job: IngestJob = {
    id,
    tenantId: input.tenantId,
    userId: input.userId,
    companyId: input.companyId,
    status: "running",
    progress: { processed: 0, total: 0 },
    startedAt: Date.now(),
  };
  jobs.set(id, job);

  void ingestDocument({
    ...input,
    onProgress: (processed, total) => {
      job.progress = { processed, total };
    },
  })
    .then((result) => {
      job.result = result;
      job.status = "complete";
    })
    .catch((err) => {
      job.error = err instanceof Error ? err.message : String(err);
      job.status = "error";
      console.error(`[ingest-job ${id}] failed:`, err);
    });

  return id;
}

/** Fetch a job — scoped to the tenant + user that created it (C1). */
export function getIngestJob(id: string, tenantId: string, userId: number): IngestJob | null {
  const job = jobs.get(id);
  if (!job || job.tenantId !== tenantId || job.userId !== userId) return null;
  return job;
}

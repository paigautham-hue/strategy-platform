/**
 * Live research SSE endpoint — GET /api/research/stream
 *
 * Streams the research mesh as it works: a `start` event (the selected
 * specialists), a `memory` event, one `specialist` event per agent as it
 * completes, a `synthesizing` event, then `complete` with the full brief.
 *
 * EventSource can only GET and can't set headers, but it sends the session
 * cookie, so we authenticate the same way as tRPC (sdk.authenticateRequest) and
 * enforce the C1 company-access boundary before streaming. LLM calls inside the
 * mesh still flow through the budget-enforced router (C3/C7).
 */

import type { Request, Response } from "express";
import { sdk } from "./sdk";
import { canAccessCompany } from "../services/access";
import { streamResearchMesh } from "../agents/research";
import { QUESTION_TYPES, type QuestionType } from "../agents/diagnosis";

export async function researchStreamHandler(req: Request, res: Response) {
  let user;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    user = null;
  }
  if (!user) return res.status(401).json({ error: "unauthenticated" });

  const question = typeof req.query.question === "string" ? req.query.question.trim() : "";
  const companyId = Number(req.query.companyId);
  const typeParam = typeof req.query.type === "string" ? req.query.type : "custom";
  const questionType: QuestionType = (QUESTION_TYPES as readonly string[]).includes(typeParam)
    ? (typeParam as QuestionType)
    : "custom";

  if (!question || question.length > 2000) return res.status(400).json({ error: "invalid question" });
  if (!Number.isInteger(companyId)) return res.status(400).json({ error: "invalid companyId" });
  if (!canAccessCompany(user.role, user.assignedCompanyIds ?? null, companyId)) {
    return res.status(403).json({ error: "no access to this company" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Disable proxy buffering so events flush immediately.
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 10000\n\n");

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  const send = (e: unknown) => {
    if (closed) return;
    res.write(`data: ${JSON.stringify(e)}\n\n`);
  };

  try {
    await streamResearchMesh(
      question,
      questionType,
      companyId,
      { tenantId: user.tenantId, companyId, userId: user.id },
      send,
    );
  } catch (err) {
    send({ type: "error", message: err instanceof Error ? err.message : "research failed" });
  } finally {
    if (!closed) {
      res.write("event: end\ndata: {}\n\n");
      res.end();
    }
  }
}

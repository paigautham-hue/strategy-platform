/**
 * Digital Twin — dimension-steered discovery (salvaged from Dynamo)
 * IMPLEMENTATION_PLAN.md Phase 1 (intake) — a conversational intake modality that
 * complements the form/ingest pipeline.
 *
 * The genuinely novel idea salvaged from the Dynamo prototype: instead of forms,
 * elicit a company's "Digital Twin" through a guided interview across five
 * business dimensions, while STEERING the model toward whichever dimensions are
 * still under-explored (the "Internal Note" pattern). This module is the PURE
 * core of that engine — dimension coverage scoring, the steering note, and the
 * completeness gates. The LLM-facing turns live in
 * `server/agents/digital-twin-interview.ts` and route through the router (C3).
 *
 * Two improvements over the donor:
 *   1. Coverage is GRADED, not binary. The donor's scorer added a flat +20 from
 *      zero on any keyword hit, so a dimension was only ever 0 or 20. Here each
 *      dimension has four facets; coverage = (facets matched / 4) × 100, giving a
 *      real 0/25/50/75/100 signal. Pure and deterministic ⇒ unit-tested.
 *   2. The donor's completeness gates were inverted (preview at 70%, full at 50%).
 *      Corrected to be monotonic: preview earlier, full strategy later.
 */

// ─────────────────────────────────────────────────────────────────────────────
// DIMENSIONS
// ─────────────────────────────────────────────────────────────────────────────

export const DIMENSIONS = {
  businessModel: "Business Model",
  financials: "Financials",
  operations: "Operations",
  organization: "Organization",
  technology: "Technology",
} as const;

export type Dimension = keyof typeof DIMENSIONS;
export const DIMENSION_KEYS = Object.keys(DIMENSIONS) as Dimension[];

export type DimensionCoverage = Record<Dimension, number>;

/**
 * Four facets per dimension. A dimension's coverage is the share of its facets
 * mentioned anywhere in the conversation, × 100. Facets are deliberately
 * non-overlapping so the score is a real breadth signal.
 */
// Note: stems are intentionally NOT trailing-anchored (e.g. "competit" must
// match "competitive"/"competition"; "customer" must match "customers").
// Leading \b is used only where a short token risks false positives.
const FACETS: Record<Dimension, RegExp[]> = {
  businessModel: [
    /revenue stream|pricing|monetiz|monetis|\bsell\b|selling|go.to.market|business model/i,
    /customer|client|segment|\bmarket|audience|buyer/i,
    /value prop|\bproducts?\b|service|offering/i, // \bproduct\b so operations' "production" doesn't credit businessModel
    /competit|positioning|differentiat|\bmoat\b/i,
  ],
  financials: [
    /revenue|profit|margin|ebitda|\bp&l\b|turnover/i,
    /cash flow|\bburn\b|runway|liquidit/i,
    /budget|\bcost|expense|opex|capex|spend/i,
    /growth|funding|investment|capital|fundrais/i,
  ],
  operations: [
    /process|workflow|procedure|\bsop\b/i,
    /supply chain|production|manufactur|logistics|fulfil/i,
    /efficien|throughput|capacity|utiliz|utilis/i,
    /quality|defect|\bsla\b|turnaround|\btat\b/i,
  ],
  organization: [
    /\bteam|headcount|staff|employee|workforce/i,
    /culture|leadership|\bmanagement team\b|senior management|governance/i,
    /talent|\bhir(e|ing)|recruit|\bskill/i,
    /change readiness|training|upskill|reorg/i,
  ],
  technology: [
    /tech stack|software|\bsystem|platform|application/i,
    /\bdata\b|infrastructure|database|warehouse|pipeline/i,
    /digital maturity|automat|\bai\b|\bml\b|analytics/i,
    /cloud|it capabilit|integration|\bapi\b|tooling/i,
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// COVERAGE SCORING (pure)
// ─────────────────────────────────────────────────────────────────────────────

export interface ConversationMessage {
  role: string;
  content: string;
}

/** Concatenate message content into one lowercased haystack. Pure. */
function conversationText(messages: ConversationMessage[]): string {
  return messages.map((m) => String(m.content ?? "")).join("\n").toLowerCase();
}

/**
 * Score each dimension 0–100 by how many of its four facets the USER mentioned.
 * Only user-authored content counts — the consultant naming a dimension in a
 * question must not inflate that dimension before the user has answered.
 * Pure and deterministic.
 */
export function scoreDimensionCoverage(messages: ConversationMessage[]): DimensionCoverage {
  const text = conversationText(messages.filter((m) => m.role === "user"));
  const coverage = {} as DimensionCoverage;
  for (const dim of DIMENSION_KEYS) {
    const facets = FACETS[dim];
    const matched = facets.reduce((acc, re) => acc + (re.test(text) ? 1 : 0), 0);
    coverage[dim] = Math.round((matched / facets.length) * 100);
  }
  return coverage;
}

/** Overall completeness = mean of the five dimension scores, rounded. Pure. */
export function overallCompleteness(coverage: DimensionCoverage): number {
  const sum = DIMENSION_KEYS.reduce((acc, d) => acc + coverage[d], 0);
  return Math.round(sum / DIMENSION_KEYS.length);
}

/** Dimensions below `threshold` (default 30), least-covered first. Pure. */
export function underexploredDimensions(coverage: DimensionCoverage, threshold = 30): Dimension[] {
  return DIMENSION_KEYS.filter((d) => coverage[d] < threshold).sort((a, b) => coverage[a] - coverage[b]);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETENESS GATES (pure) — corrected to be monotonic
// ─────────────────────────────────────────────────────────────────────────────

/** Overall completeness at/above which a short opportunity PREVIEW is offered. */
export const PREVIEW_THRESHOLD = 40;
/** Overall completeness at/above which a FULL strategy may be generated. */
export const GENERATE_THRESHOLD = 70;

export interface CompletenessGates {
  overall: number;
  previewAvailable: boolean;
  fullStrategyAvailable: boolean;
}

/** Evaluate the funnel gates from a coverage map. Pure. */
export function completenessGates(coverage: DimensionCoverage): CompletenessGates {
  const overall = overallCompleteness(coverage);
  return {
    overall,
    previewAvailable: overall >= PREVIEW_THRESHOLD,
    fullStrategyAvailable: overall >= GENERATE_THRESHOLD,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STEERING (pure) — the salvaged "Internal Note" pattern
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the "Internal Note" appended to the system prompt: tells the model the
 * current per-dimension coverage and which under-explored dimension to steer
 * toward next. This is the core reusable idea from Dynamo. Pure.
 */
export function buildSteeringNote(coverage: DimensionCoverage): string {
  const unexplored = underexploredDimensions(coverage);
  const lines = DIMENSION_KEYS.map((d) => `- ${DIMENSIONS[d]}: ${coverage[d]}%`).join("\n");

  if (unexplored.length === 0) {
    return (
      `\n\n**Internal Note (do not quote verbatim):** Coverage so far:\n${lines}\n\n` +
      `All five dimensions have initial coverage. Deepen the thinnest areas or move toward wrapping up the discovery.`
    );
  }

  return (
    `\n\n**Internal Note (do not quote verbatim):** Coverage so far:\n${lines}\n\n` +
    `Under-explored: ${unexplored.map((d) => DIMENSIONS[d]).join(", ")}. ` +
    `After acknowledging the user's last answer, transition to ask about ${DIMENSIONS[unexplored[0]]}.`
  );
}

/** The standing discovery-consultant persona (static prefix, cache-friendly C18). */
export const DISCOVERY_SYSTEM_PROMPT = `You are an elite strategy consultant running a conversational discovery to build a structured "Digital Twin" of a company across five dimensions:

1. Business Model — revenue streams, customers, value proposition, competitive positioning
2. Financials — revenue, profitability, cash flow, growth, budget
3. Operations — processes, supply chain, efficiency, quality
4. Organization — team, culture, leadership, talent, change readiness
5. Technology — tech stack, data infrastructure, digital maturity, IT capability

Approach:
- Ask at most two thoughtful, open-ended questions at a time.
- Acknowledge the user's answer before asking the next question.
- Keep replies to 2–3 short paragraphs.
- Offer brief micro-insights as you learn, not full recommendations.
- Systematically cover all five dimensions; after 3–4 exchanges on one, transition to the next and signal the transition explicitly.`;

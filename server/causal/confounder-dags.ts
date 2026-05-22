/**
 * Confounder DAGs — IMPLEMENTATION_PLAN.md Phase 6, Workstream 6.6 (L1, L3)
 *
 * A hand-curated, per-industry directed acyclic graph of the confounders that
 * a causal claim MUST be conditioned on. When the attribution agent (6.4)
 * credits an initiative for an outcome, it has to rule out — or at least name —
 * the macro and market forces that could explain the same result.
 *
 * The DAGs are deliberately small and hand-curated, not learned: a short,
 * trustworthy list of "things that were also true" beats a sprawling inferred
 * graph. `isAcyclic` is a pure check that the curated data really is a DAG.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ConfounderNode {
  id: string;
  label: string;
  /** Why this factor can masquerade as a cause. */
  description: string;
}

/** A directed edge `from` → `to`: `from` influences `to`. */
export interface ConfounderEdge {
  from: string;
  to: string;
}

export interface ConfounderDag {
  /** The industry key this DAG applies to. */
  industry: string;
  label: string;
  nodes: ConfounderNode[];
  edges: ConfounderEdge[];
}

// ─────────────────────────────────────────────────────────────────────────────
// THE DAGS
// ─────────────────────────────────────────────────────────────────────────────

export const CONFOUNDER_DAGS: readonly ConfounderDag[] = [
  {
    industry: "b2b_saas",
    label: "B2B SaaS",
    nodes: [
      { id: "macro_rates", label: "Macro interest rates", description: "Shape enterprise budget appetite and the length of deal cycles." },
      { id: "hiring_market", label: "Hiring market", description: "Availability and cost of go-to-market and engineering talent." },
      { id: "ai_disruption", label: "AI disruption", description: "Shifts in what buyers expect and what competitors can ship." },
      { id: "category_maturity", label: "Category maturity", description: "Whether the category is expanding, saturating, or consolidating." },
      { id: "budget_seasonality", label: "Budget seasonality", description: "Q4 / Q1 enterprise procurement and renewal cycles." },
      { id: "competitor_funding", label: "Competitor funding", description: "A rival's raise changes pricing pressure and pace." },
    ],
    edges: [
      { from: "macro_rates", to: "budget_seasonality" },
      { from: "macro_rates", to: "competitor_funding" },
      { from: "ai_disruption", to: "category_maturity" },
      { from: "competitor_funding", to: "category_maturity" },
    ],
  },
  {
    industry: "fintech",
    label: "Fintech",
    nodes: [
      { id: "macro_rates", label: "Interest rates", description: "Directly move net interest margin and lending demand." },
      { id: "regulatory_regime", label: "Regulatory regime", description: "Licensing, capital rules, and enforcement posture." },
      { id: "credit_cycle", label: "Credit cycle", description: "Default rates and the market's risk appetite." },
      { id: "incumbent_response", label: "Incumbent response", description: "How established banks price and partner in reaction." },
      { id: "consumer_confidence", label: "Consumer confidence", description: "Transaction volume and deposit flows." },
    ],
    edges: [
      { from: "macro_rates", to: "credit_cycle" },
      { from: "macro_rates", to: "consumer_confidence" },
      { from: "credit_cycle", to: "incumbent_response" },
      { from: "regulatory_regime", to: "incumbent_response" },
    ],
  },
  {
    industry: "consumer",
    label: "Consumer / D2C",
    nodes: [
      { id: "consumer_confidence", label: "Consumer confidence", description: "Discretionary spend and basket size." },
      { id: "input_costs", label: "Input costs", description: "COGS, freight, and fulfilment cost swings." },
      { id: "channel_algorithm", label: "Channel algorithm", description: "Platform algorithm and ad-auction changes that move CAC." },
      { id: "seasonality", label: "Seasonality", description: "Holiday and seasonal demand peaks and troughs." },
      { id: "competitor_promotion", label: "Competitor promotion", description: "Rival discounting that shifts share temporarily." },
    ],
    edges: [
      { from: "consumer_confidence", to: "seasonality" },
      { from: "input_costs", to: "competitor_promotion" },
      { from: "channel_algorithm", to: "competitor_promotion" },
    ],
  },
  {
    industry: "marketplace",
    label: "Marketplace",
    nodes: [
      { id: "network_density", label: "Network density", description: "Liquidity on both sides — the dominant driver of marketplace outcomes." },
      { id: "take_rate_pressure", label: "Take-rate pressure", description: "Competitive and supplier pressure on the fee the marketplace can charge." },
      { id: "supply_constraints", label: "Supply constraints", description: "Scarcity or churn on the supply side." },
      { id: "macro_demand", label: "Macro demand", description: "Underlying category demand independent of the marketplace's actions." },
      { id: "platform_dependency", label: "Platform dependency", description: "Reliance on a third-party platform for traffic or payments." },
    ],
    edges: [
      { from: "macro_demand", to: "network_density" },
      { from: "supply_constraints", to: "network_density" },
      { from: "supply_constraints", to: "take_rate_pressure" },
    ],
  },
  {
    industry: "healthcare",
    label: "Healthcare",
    nodes: [
      { id: "reimbursement_policy", label: "Reimbursement policy", description: "Payer reimbursement rates and coverage decisions." },
      { id: "regulatory_approval", label: "Regulatory approval", description: "Approval timelines and compliance requirements." },
      { id: "payer_mix", label: "Payer mix", description: "The blend of public, private, and self-pay revenue." },
      { id: "clinical_evidence", label: "Clinical evidence", description: "The strength of the evidence base for the offering." },
      { id: "labor_shortage", label: "Labor shortage", description: "Clinical staffing availability and cost." },
    ],
    edges: [
      { from: "regulatory_approval", to: "reimbursement_policy" },
      { from: "clinical_evidence", to: "regulatory_approval" },
      { from: "reimbursement_policy", to: "payer_mix" },
    ],
  },
  {
    industry: "generic",
    label: "General",
    nodes: [
      { id: "macro_conditions", label: "Macro conditions", description: "The broad economic backdrop — rates, growth, sentiment." },
      { id: "competitive_dynamics", label: "Competitive dynamics", description: "Rivals' moves that shift the result independently." },
      { id: "regulatory_environment", label: "Regulatory environment", description: "Rules and enforcement that constrain or enable outcomes." },
      { id: "talent_market", label: "Talent market", description: "Availability and cost of the people needed to execute." },
      { id: "seasonality", label: "Seasonality", description: "Recurring time-of-year effects on demand and supply." },
    ],
    edges: [
      { from: "macro_conditions", to: "competitive_dynamics" },
      { from: "macro_conditions", to: "talent_market" },
    ],
  },
] as const;

const GENERIC_DAG = CONFOUNDER_DAGS.find((d) => d.industry === "generic")!;

// ─────────────────────────────────────────────────────────────────────────────
// LOOKUP + RENDERING
// ─────────────────────────────────────────────────────────────────────────────

/** The picker-facing list of industries with a curated DAG. Pure. */
export function listConfounderIndustries(): { industry: string; label: string }[] {
  return CONFOUNDER_DAGS.map((d) => ({ industry: d.industry, label: d.label }));
}

/**
 * Resolve a free-text industry string to the best-matching DAG, falling back
 * to the generic DAG. Pure — exported for tests.
 */
export function getConfounderDag(industry: string | null | undefined): ConfounderDag {
  const q = (industry ?? "").trim().toLowerCase();
  if (!q) return GENERIC_DAG;

  // Direct key match.
  const direct = CONFOUNDER_DAGS.find((d) => d.industry === q);
  if (direct) return direct;

  // Keyword match against common industry phrasings.
  const keywords: Record<string, string[]> = {
    b2b_saas: ["saas", "b2b", "software", "enterprise software", "cloud"],
    fintech: ["fintech", "finance", "financial", "bank", "lending", "payments", "insurance"],
    consumer: ["consumer", "d2c", "dtc", "retail", "ecommerce", "e-commerce", "cpg", "brand"],
    marketplace: ["marketplace", "platform", "two-sided", "gig"],
    healthcare: ["health", "healthcare", "medical", "clinical", "biotech", "pharma", "digital health"],
  };
  for (const [key, terms] of Object.entries(keywords)) {
    if (terms.some((t) => q.includes(t))) {
      return CONFOUNDER_DAGS.find((d) => d.industry === key) ?? GENERIC_DAG;
    }
  }
  return GENERIC_DAG;
}

/** Render a DAG's confounders as a prompt block for the attribution agent. Pure. */
export function renderConfounders(dag: ConfounderDag): string {
  const nodes = dag.nodes.map((n) => `- ${n.label}: ${n.description}`).join("\n");
  const edges = dag.edges
    .map((e) => {
      const from = dag.nodes.find((n) => n.id === e.from)?.label ?? e.from;
      const to = dag.nodes.find((n) => n.id === e.to)?.label ?? e.to;
      return `- ${from} influences ${to}`;
    })
    .join("\n");
  return (
    `Known confounders for the ${dag.label} industry:\n${nodes}` +
    (edges ? `\n\nKnown influences among them:\n${edges}` : "")
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DAG VALIDITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify a confounder graph is acyclic — a curated DAG must never contain a
 * cycle. Pure depth-first cycle detection. Exported for tests.
 */
export function isAcyclic(dag: ConfounderDag): boolean {
  const adjacency = new Map<string, string[]>();
  for (const node of dag.nodes) adjacency.set(node.id, []);
  for (const edge of dag.edges) {
    const list = adjacency.get(edge.from);
    if (list) list.push(edge.to);
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const node of dag.nodes) color.set(node.id, WHITE);

  const hasCycleFrom = (id: string): boolean => {
    color.set(id, GRAY);
    for (const next of adjacency.get(id) ?? []) {
      const c = color.get(next);
      if (c === GRAY) return true;
      if (c === WHITE && hasCycleFrom(next)) return true;
    }
    color.set(id, BLACK);
    return false;
  };

  for (const node of dag.nodes) {
    if (color.get(node.id) === WHITE && hasCycleFrom(node.id)) return false;
  }
  return true;
}

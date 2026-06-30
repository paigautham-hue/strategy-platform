/**
 * User Manual + FAQ content for the in-app help surface (`/manual`).
 *
 * Plain data so the manual is easy to keep current: when a feature changes,
 * edit the entry here. Rendered by `client/src/pages/Manual.tsx`.
 */

export interface ManualEntry {
  /** The feature or concept name. */
  term: string;
  /** A clear, self-contained explanation. */
  body: string;
}

export interface ManualSection {
  id: string;
  title: string;
  /** A one-paragraph orientation for the section. */
  intro: string;
  entries: ManualEntry[];
}

export interface FaqItem {
  q: string;
  a: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MANUAL SECTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: "welcome",
    title: "1 · What Cairn is",
    intro:
      "Cairn is a private strategy platform for an investor and their portfolio companies. " +
      "It is not a chatbot. It is a system that remembers, reasons, simulates, translates strategy " +
      "into execution, and — crucially — learns over time which of its judgements were right.",
    entries: [
      {
        term: "The core idea — strategy that compounds",
        body:
          "Every session adds to a durable, structured memory of your companies. The next session " +
          "starts from everything learned in every prior one. Over months the platform becomes more " +
          "useful precisely because it has accumulated context, predictions, and outcomes you can audit.",
      },
      {
        term: "Diagnosis before frameworks",
        body:
          "Cairn never opens with a menu of strategy frameworks. It first diagnoses the real " +
          "question — what kind of problem this is — and only then selects the few frameworks that " +
          "actually fit. A framework is a tool, not a ritual.",
      },
      {
        term: "Every claim is measured",
        body:
          "When the platform makes a strategic claim, it records it in a prediction ledger with a " +
          "confidence and a horizon. When the outcome is known, the ledger closes the loop. This is " +
          "what lets the platform tell you — honestly — how well-calibrated it has been.",
      },
      {
        term: "Briefing-default",
        body:
          "Outputs lead with the synthesis — the recommendation, the verdict, the memo — and keep the " +
          "raw detail underneath. You should be able to act on the top of any screen and drill down " +
          "only when you want to.",
      },
    ],
  },
  {
    id: "getting-started",
    title: "2 · Getting started",
    intro:
      "Three steps put the platform to work: sign in, onboard a company, and select it as the active " +
      "company. Almost every feature operates on the active company.",
    entries: [
      {
        term: "Signing in",
        body:
          "Access is restricted to authorised personnel. Sign in from the gate screen; your account " +
          "is created automatically on first sign-in. Your role determines what you can see — see " +
          "section 10 on roles.",
      },
      {
        term: "Onboard Company",
        body:
          "The onboarding wizard creates a portfolio company and seeds its initial context — industry, " +
          "stage, the strategic situation. The richer the onboarding, the sharper every later answer, " +
          "because diagnosis and reasoning are grounded in what the platform knows.",
      },
      {
        term: "The active company switcher",
        body:
          "The dropdown at the top of the sidebar selects the active company. Ingest, Memory, Diagnose, " +
          "War-Game and most other surfaces act on whichever company is active. Switch companies freely; " +
          "each one's memory is kept strictly separate.",
      },
      {
        term: "The Overview dashboard",
        body:
          "The home screen shows company count, memory size, the prediction ledger, your LLM cost, and " +
          "a System Status strip. It is the at-a-glance health check for the active company and the " +
          "platform itself.",
      },
    ],
  },
  {
    id: "knowledge",
    title: "3 · Knowledge & memory",
    intro:
      "Memory is the foundation everything else stands on. You feed the platform documents and notes; " +
      "it extracts durable, dated, confidence-scored claims and retrieves the right ones whenever an " +
      "agent reasons.",
    entries: [
      {
        term: "Ingest",
        body:
          "Drop in documents, pasted text, web pages, or files. The ingest pipeline cleans the source, " +
          "splits it into chunks, extracts discrete strategic claims, normalises numbers and dates, " +
          "scores each claim's trustworthiness by source, and writes it to memory.",
      },
      {
        term: "Memory",
        body:
          "The Memory page is the searchable knowledge base for a company. Every item is a single " +
          "claim with a confidence score, a source, and a validity period. You can review what the " +
          "platform believes and where each belief came from.",
      },
      {
        term: "Voice Intake",
        body:
          "Speak instead of type. Voice Intake uses your browser's speech recognition for a one-shot " +
          "capture, then parses the intent and routes it — a note becomes memory, a question becomes a " +
          "diagnosis, and so on.",
      },
      {
        term: "Vision Studio (image in / image out)",
        body:
          "Vision Studio turns pictures into structure and structure into pictures. Extract: upload a " +
          "slide, a whiteboard photo, or a chart and a multimodal model reads it into structured text " +
          "you can push to memory. Generate: describe a diagram or visual and the platform renders an " +
          "image. The image is stored privately and only its URL is sent to the model, so large uploads " +
          "never blow the token budget.",
      },
      {
        term: "Talk to Cairn (realtime voice)",
        body:
          "The \"Talk to Cairn\" button in the sidebar starts a live, spoken conversation about the " +
          "active company. It is a real-time voice call — you speak, Cairn answers out loud, and it can " +
          "look up the company's profile, memory, and predictions mid-conversation to stay grounded. " +
          "Closing the call window does not hang up: a small player stays pinned in the corner so you " +
          "can keep working while the call continues, then re-open or end it whenever you like. " +
          "(Requires the deployment's OpenAI key to have Realtime API access.)",
      },
      {
        term: "How retrieval works",
        body:
          "When an agent needs context it runs a hybrid search: semantic similarity (vector) fused with " +
          "keyword relevance via Reciprocal Rank Fusion, then diversified with Maximal Marginal " +
          "Relevance so the results are both on-point and non-redundant.",
      },
      {
        term: "Bi-temporal memory & decay",
        body:
          "Claims are never silently deleted. When a new claim supersedes an old one, the old one is " +
          "marked superseded with a validity interval — the history stays auditable. Confidence also " +
          "decays over time, so stale claims quietly lose weight unless they are reaffirmed.",
      },
    ],
  },
  {
    id: "intake",
    title: "4 · Strategy intake",
    intro:
      "Several surfaces turn raw thinking — an external playbook, a brainstorm, a dictated monologue — " +
      "into structured strategy the engine can work with.",
    entries: [
      {
        term: "Strategy Artifacts & Share-and-Apply",
        body:
          "Paste an external strategy — an article, a playbook, a case study. The platform recognises " +
          "its structure (thesis, preconditions, key moves) and then applies it to your company: a fit " +
          "score, the gaps, each move rewritten for your context, and an application memo.",
      },
      {
        term: "Brainstorm Mode",
        body:
          "A structured brainstorm runs four phases — Diverge, Probe, Sharpen, Lock. As you think out " +
          "loud, five silent extractors capture hypotheses, options, assumptions, risks, and open " +
          "questions into a draft tray, and a recap names the themes and suggested next moves.",
      },
      {
        term: "Memo Dictation",
        body:
          "Talk for a few minutes; the platform turns the monologue into a clean one-page memo — a " +
          "title, an executive summary, labelled sections, decisions, and next actions. It stays " +
          "faithful to what you said and never invents facts.",
      },
      {
        term: "Advisory Personas",
        body:
          "The same question lands differently depending on who you ask. Put a question to The Coach, " +
          "The Challenger, The Devil's Advocate, The Consultant, or The Chief of Staff — each answers " +
          "in its own stance, grounded in your company's memory.",
      },
      {
        term: "Discovery — the Digital Twin",
        body:
          "A guided interview that builds a structured picture of a business across five dimensions — " +
          "Business Model, Financials, Operations, Organization, Technology. As you answer, the " +
          "consultant steers toward whatever is still under-explored, live coverage meters fill, and " +
          "two gates unlock: a quick opportunity preview, then a full AI-transformation strategy " +
          "(readiness score, opportunities, use cases, risks) generated from the captured twin.",
      },
    ],
  },
  {
    id: "reasoning",
    title: "5 · Reasoning",
    intro:
      "The reasoning surfaces take a strategic question and work it properly — diagnose it, research " +
      "it, stress its internal consistency, apply the right frameworks, generate options, and attack " +
      "the result.",
    entries: [
      {
        term: "Diagnose",
        body:
          "The starting point for any real question. Diagnosis classifies what kind of problem you " +
          "actually have before any framework is chosen — it is the platform's refusal to reach for a " +
          "template too early.",
      },
      {
        term: "Research",
        body:
          "A research mesh dispatches specialist agents to gather and synthesise what is known, " +
          "grounded in company memory, and returns a structured brief rather than a wall of text.",
      },
      {
        term: "Live Research",
        body:
          "The same research mesh, watched live. Instead of waiting for the finished brief, each " +
          "specialist appears in an activity tree and fills in the moment it finishes — then the Chief " +
          "Strategist synthesises at the end. Use it when you want to see the reasoning unfold and read " +
          "early findings while the rest are still running.",
      },
      {
        term: "Contradictions",
        body:
          "As memory grows, beliefs can collide. The Contradictions surface finds claims that conflict " +
          "and lets you resolve them — keeping the knowledge base coherent.",
      },
      {
        term: "Frameworks",
        body:
          "The framework library applies the established strategy frameworks — but only the few the " +
          "diagnosis judged relevant. You see structured output, not a generic framework dump.",
      },
      {
        term: "Options",
        body:
          "The option generator produces several distinct strategic options for a question and scores " +
          "each against eight weighted criteria (MCDA). Weighting, ranking, and a sensitivity check are " +
          "deterministic — the model proposes, the maths ranks.",
      },
      {
        term: "Red Team",
        body:
          "Five hostile personas — the Contrarian, the Regulator, the Incumbent, the Skeptical " +
          "Investor, the Execution Skeptic — attack a strategy. Each critique is graded; any fatal flaw " +
          "means the strategy has not survived. The verdict is computed, never left to the model.",
      },
    ],
  },
  {
    id: "simulation",
    title: "6 · Simulation",
    intro:
      "A strategy is not trusted until it has been played out against the people who will react to it. " +
      "The war-games do exactly that.",
    entries: [
      {
        term: "War-Game",
        body:
          "Plays a strategy over several rounds against four reacting stakeholders — a customer " +
          "archetype, a competitor CEO, a regulator, and an activist investor. Later rounds escalate " +
          "the earlier ones; an adjudicator judges whether the strategy survived.",
      },
      {
        term: "Cross-Co War-Game",
        body:
          "GP-only. Applies one shared shock — an FX swing, a supplier acquisition, a new regulation — " +
          "across two or more portfolio companies at once, and surfaces the non-obvious cross-company " +
          "synergies and correlated risks.",
      },
      {
        term: "Deep mode on Share-and-Apply",
        body:
          "When you apply an external strategy, deep mode runs a quick micro war-game on the adapted " +
          "moves and compares the simulated outcome against what the original artifact claimed to " +
          "expect.",
      },
      {
        term: "Synthetic outcomes",
        body:
          "War-game results are simulated, not real. They are recorded to the prediction ledger as " +
          "synthetic and scored separately, so simulation never contaminates the platform's real-world " +
          "calibration record.",
      },
      {
        term: "Financial Simulation",
        body:
          "A Monte Carlo projection of a multi-year revenue plan: enter base revenue, per-year growth, " +
          "margins and volatilities, and it runs thousands of seeded paths to produce a mean and median " +
          "NPV, a percentile distribution, downside risk (probability of loss, Value-at-Risk, expected " +
          "shortfall, Sharpe), and a best/base/worst comparison. Seeded, so the same inputs reproduce " +
          "the same distribution. Amounts show in ₹ Crore with a USD equivalent.",
      },
    ],
  },
  {
    id: "execution",
    title: "7 · Strategy → execution",
    intro:
      "A strategy that never becomes a plan is just an opinion. These surfaces translate a thesis into " +
      "initiatives, pressure-test them before launch, and watch them for drift afterwards.",
    entries: [
      {
        term: "Decompose",
        body:
          "Turns a strategy thesis into 3-5 concrete initiatives, each with a rationale, expected " +
          "impact, cost estimate, confidence, dependencies, OKRs, and a task list. A built-in " +
          "challenger flags every objective that lacks a measurable key result.",
      },
      {
        term: "Pre-Mortem",
        body:
          "Before an initiative goes active, run a pre-mortem: assume it is twelve months later and the " +
          "initiative failed, then work backwards to a risk register — each risk graded, with an " +
          "early-warning sign and a mitigation.",
      },
      {
        term: "Drift Detection",
        body:
          "Watches an active initiative for divergence on three axes: schedule (actual vs planned " +
          "progress), KPI (a leading indicator vs expected, gated on a minimum sample size), and " +
          "thesis (the assumption invalidated). When drift is found, a replan engine proposes Continue, " +
          "Adjust-pace, Pivot, or Kill.",
      },
      {
        term: "Strategic Tracker",
        body:
          "Turns a strategy context into trackable artifacts: paste the goals and plan, and it generates " +
          "and saves KPIs (with targets, units, and a category), roadmap milestones (with quarter and " +
          "fiscal year), and a scored risk register (probability × impact). Each item is validated " +
          "before it is written, and the three live in tabs you can browse per company.",
      },
    ],
  },
  {
    id: "learning",
    title: "8 · The learning loop",
    intro:
      "This is what makes the platform get better. It records what it predicted, scores how well those " +
      "predictions held up, attributes outcomes honestly, and distils what recurs into reusable " +
      "playbooks.",
    entries: [
      {
        term: "Predictions",
        body:
          "The prediction ledger — every strategic claim the platform made, with its confidence, " +
          "horizon, and (once known) its outcome. Nothing the engine asserts escapes this ledger.",
      },
      {
        term: "Calibration",
        body:
          "Scores how well-calibrated the platform's probabilistic claims have been, using proper " +
          "scoring rules — the Brier score with Murphy's reliability / resolution / uncertainty " +
          "breakdown — so confident hedging cannot game the score. Real and synthetic outcomes are " +
          "scored separately.",
      },
      {
        term: "Attribution",
        body:
          "When an initiative completes, causal-lite attribution asks the hard question: did the " +
          "initiative cause the outcome, or would it have happened anyway? It names the variables " +
          "changed, a counterfactual, the credit split, and the confounders any causal claim must " +
          "account for.",
      },
      {
        term: "Constitutional Audit",
        body:
          "An anti-hallucination audit that measures principle-compliance, not vibes. Explicit, " +
          "checkable rules — numeric claims cite a source, predictions specify horizon and confidence, " +
          "causal claims name confounders — are applied to the ledger and violations are flagged.",
      },
      {
        term: "Playbooks",
        body:
          "A playbook is a reusable strategic skill — triggers, gated steps, expected outcomes. " +
          "Playbooks are promoted project → company → portfolio only after passing outcome and " +
          "diversity gates, and are retired automatically if their hit rate falls too low.",
      },
      {
        term: "Pattern Mining",
        body:
          "Across a set of past projects, the miner finds the recurring decision structures that work " +
          "and the failure shapes that repeat. A pattern that recurs becomes a candidate for a new " +
          "playbook.",
      },
    ],
  },
  {
    id: "portfolio",
    title: "9 · Portfolio intelligence (GP)",
    intro:
      "Portfolio surfaces look across companies. Because they deliberately cross the company boundary, " +
      "they are GP-only and every cross-company read is audit-logged.",
    entries: [
      {
        term: "Portfolio Dashboard & closing the learning loop",
        body:
          "The Portfolio Dashboard shows calibration across every company side by side — Brier score and " +
          "hit rate — so you can see where the platform's forecasts have actually been reliable. It is " +
          "also where you close the loop: open predictions that have come due are listed with simple " +
          "'Held' / 'Didn't hold' buttons. Resolving one records the real outcome, which feeds " +
          "calibration. This is what makes the learning data-dependent — the scorecards improve only as " +
          "you tell the platform what really happened. A nightly snapshot keeps the figures current.",
      },
      {
        term: "Synergy Scout",
        body:
          "Nine detectors — capability, customer, supplier, channel, geographic, talent, tech/IP, " +
          "capital-structure, and macro-exposure overlap — scan two or more portfolio companies for " +
          "concrete, capturable synergies.",
      },
      {
        term: "Pattern Distillation",
        body:
          "Before a pattern learned inside one company can be surfaced to another, it is anonymised — " +
          "company names, dollar amounts, and dates stripped — and gated on being drawn from at least " +
          "three portcos, so no single company can be re-identified.",
      },
      {
        term: "Briefing",
        body:
          "A daily or weekly board-style briefing synthesises the platform's recent signals into a " +
          "headline, labelled sections, a prioritised 'what needs your attention' list, and suggested " +
          "actions.",
      },
    ],
  },
  {
    id: "operations",
    title: "10 · Operations, cost & access",
    intro:
      "The operational surfaces keep the platform observable, affordable, and correctly permissioned.",
    entries: [
      {
        term: "Cost Dashboard",
        body:
          "Every model call is metered. The cost dashboard (GP+) shows spend by company and by user, " +
          "so the platform's cost is always visible and never a surprise.",
      },
      {
        term: "Audit Log",
        body:
          "An append-only record of every confidential read and write — especially every cross-company " +
          "read. Nothing sensitive happens without a trail.",
      },
      {
        term: "Usage Events",
        body:
          "A telemetry stream of what is actually used, on which surfaces — the basis for knowing the " +
          "platform earns its place in the workflow.",
      },
      {
        term: "Export",
        body:
          "GP-only export of a company's data — for board packs, backups, or portability.",
      },
      {
        term: "MCP Tools",
        body:
          "The Model Context Protocol gateway — the controlled way external tools are exposed to the " +
          "platform's agents.",
      },
      {
        term: "User Management & roles",
        body:
          "Admin-only. There are four roles: Admin (platform + user management, sees everything), GP " +
          "(strategy lead, sees every company), Operator (runs companies, scoped to assigned " +
          "companies), and Portco Team (portfolio-company staff, scoped to their company). For " +
          "operators and portco teams you assign which companies they may see; gp and admin always see " +
          "all. Users appear automatically on first sign-in.",
      },
    ],
  },
  {
    id: "intelligence",
    title: "11 · The intelligence under the hood",
    intro:
      "What makes Cairn more than a prompt. These are the principles that govern how the engine " +
      "reasons — worth understanding so you can trust, and challenge, what it tells you.",
    entries: [
      {
        term: "Multi-agent orchestration",
        body:
          "Hard questions are not answered by one model call. A lead agent dispatches specialists — " +
          "diagnosis, research, framework, option, red-team, simulation — and composes their output. " +
          "Each specialist does one thing well.",
      },
      {
        term: "The LLM router",
        body:
          "Every model and embedding call goes through a single router. It redacts personal data " +
          "before any call, enforces a spend budget, logs the cost of every call, and selects the " +
          "model from configuration — never a hardcoded choice.",
      },
      {
        term: "Defensive parsing — the verdict is never the model's",
        body:
          "Model output is treated as untrusted input. Every binary verdict — did the strategy survive " +
          "the red team, is an OKR measurable, how severe is the drift, can a playbook be promoted — is " +
          "computed by deterministic, tested code from the model's structured output. This is why the " +
          "platform's judgements are stable and auditable.",
      },
      {
        term: "Synthetic vs real, kept apart",
        body:
          "Simulated outcomes (war-games) are abundant and cheap; real outcomes are scarce and slow. " +
          "They are tagged and scored in separate strata so simulation can never drown out reality in " +
          "the calibration record.",
      },
      {
        term: "Company namespacing & privacy",
        body:
          "Every row of memory, every prediction, every audit entry is namespaced to a tenant and a " +
          "company. The platform is company-isolated by default; crossing that boundary is rare, " +
          "GP-only, three-layer enforced, and always audit-logged.",
      },
      {
        term: "The compounding loop",
        body:
          "Ingest builds memory → diagnosis and reasoning use memory → predictions are logged → " +
          "outcomes close them → calibration scores the engine → patterns become playbooks → the next " +
          "question starts from all of it. That loop is the whole point.",
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FAQ
// ─────────────────────────────────────────────────────────────────────────────

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Where do I start?",
    a: "Onboard a company, select it as the active company, then Ingest a few documents so the " +
      "platform has context. From there, Diagnose a real question — everything flows from a good " +
      "diagnosis.",
  },
  {
    q: "Why is everything showing zero?",
    a: "That is the empty state — no company has been onboarded yet. Counts populate as you onboard " +
      "companies, ingest documents, and run reasoning.",
  },
  {
    q: "Does the platform mix up my companies?",
    a: "No. Every memory item, prediction, and audit entry is namespaced to one company. Only the " +
      "GP-only cross-company surfaces read across companies, and every such read is audit-logged.",
  },
  {
    q: "Why does it diagnose before giving me a framework?",
    a: "Reaching for a framework before understanding the problem is the most common strategy " +
      "mistake. Diagnosis decides what kind of question you actually have, so the frameworks that " +
      "follow are the few that fit.",
  },
  {
    q: "What is the prediction ledger for?",
    a: "It records every strategic claim with a confidence and a horizon. When outcomes are known, " +
      "the ledger closes the loop and the Calibration page can show you, honestly, how accurate the " +
      "platform has been.",
  },
  {
    q: "Are war-game results real?",
    a: "No — they are simulations. They are tagged 'synthetic' and scored separately from real " +
      "outcomes, so they never inflate or distort the real-world calibration record.",
  },
  {
    q: "Can I trust the platform's verdicts?",
    a: "The verdicts — survived the red team, OKR is measurable, drift severity, playbook promotion — " +
      "are computed by deterministic, unit-tested code, not asserted by the model. The model supplies " +
      "evidence; the code decides. Still, treat outputs as well-reasoned input, not gospel.",
  },
  {
    q: "Why does the calibration page say there is no data?",
    a: "Calibration needs closed predictions — claims whose outcomes have been recorded. It populates " +
      "as predictions reach their horizon and outcomes are logged. Early on it will be empty; that is " +
      "expected.",
  },
  {
    q: "What are the four roles?",
    a: "Admin (platform and user management), GP (strategy lead, sees all companies), Operator (runs " +
      "companies, scoped to assigned companies), and Portco Team (portfolio-company staff, scoped to " +
      "their company). Admins set roles and company access from User Management.",
  },
  {
    q: "How do I give a teammate access to only their company?",
    a: "In User Management (admin-only), set their role to Operator or Portco Team, then toggle on " +
      "exactly the companies they should see. Until you scope them, a new user sees all companies.",
  },
  {
    q: "Is my data sent anywhere unsafe?",
    a: "Model calls go through one router that redacts personal data before every call and logs every " +
      "call's cost. Secrets live in the deployment vault and are never stored in the app's code.",
  },
  {
    q: "Can I use voice instead of typing?",
    a: "Yes, three ways. Voice Intake captures a one-shot note or question; Brainstorm and Memo " +
      "Dictation support browser dictation; and \"Talk to Cairn\" in the sidebar opens a live, " +
      "spoken back-and-forth about the active company. The live call needs the deployment's OpenAI " +
      "key to have Realtime API access.",
  },
  {
    q: "If I close the voice call window, does it hang up?",
    a: "No. The call is deliberately kept separate from its window — closing the overlay just minimises " +
      "it to a small player in the corner so you can keep navigating while the call runs. Only the " +
      "End button actually hangs up.",
  },
  {
    q: "Can the platform read a slide, whiteboard photo, or chart?",
    a: "Yes — Vision Studio's Extract tab reads an uploaded image into structured text you can push to " +
      "memory, and the Generate tab renders an image from a description. Uploads are stored privately; " +
      "only the image URL is sent to the model.",
  },
  {
    q: "How do calibration scores actually improve?",
    a: "By you resolving predictions. On the Portfolio Dashboard, predictions that have come due show " +
      "'Held' / 'Didn't hold' buttons; marking one records the real outcome, which feeds the Brier and " +
      "hit-rate scorecards. The learning is data-dependent — it only sharpens as real outcomes come in.",
  },
  {
    q: "What is the difference between a memo, a briefing, and a brief?",
    a: "Memo Dictation structures one monologue into a one-page memo. The Briefing synthesises recent " +
      "platform signals into a daily or weekly read. Research produces a brief that answers a " +
      "specific question.",
  },
  {
    q: "What is the Digital Twin, and how is Discovery different from Ingest?",
    a: "Ingest pulls facts from documents into memory. Discovery is a conversation: it interviews you " +
      "across five business dimensions and assembles a structured 'Digital Twin' you can save and turn " +
      "into an AI-transformation strategy. Use Ingest for documents you have, Discovery for what is in " +
      "your head.",
  },
  {
    q: "Can I model financial scenarios?",
    a: "Yes — Financial Simulation runs a seeded Monte Carlo over a multi-year plan and reports NPV, a " +
      "percentile distribution, and downside risk (probability of loss, VaR, expected shortfall, " +
      "Sharpe), plus a best/base/worst comparison. The same inputs always reproduce the same result.",
  },
  {
    q: "Where do KPIs, milestones, and risks live?",
    a: "On the Strategic Tracker (operator and above). Generate them from a strategy context and they " +
      "are validated, saved, and tracked per company — KPIs with targets and status, milestones with " +
      "timing, and a probability × impact risk register.",
  },
  {
    q: "I found a bug — what now?",
    a: "Report it. Bugs are fixed in the codebase and the deployment is refreshed. A clear " +
      "description of what you did and what you expected is the fastest path to a fix.",
  },
];

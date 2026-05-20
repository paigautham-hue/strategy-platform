# Strategy Platform — Deferred Backlog

> Items deliberately deferred from the active [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).
> Each entry states **why deferred** and the **promotion criteria** that would move it back into the active plan.
> Anchored to [GUIDING_PRINCIPLES.md](./GUIDING_PRINCIPLES.md). Items violating principles are not deferred — they are dropped to the "Won't Build" section at the bottom.

---

## How items move from this backlog into the plan

A deferred item is promoted when **all** of:
1. Its **promotion criteria** are met (defined per item below).
2. The current active phase has capacity (not blocking acceptance gate).
3. Promotion is logged in this document's changelog with date and rationale.

Items can be **dropped** if their promotion criteria become moot (provider deprecation, principle change, etc.). Drops also logged.

---

# Section A · Connectors (sequenced beyond Phase 5 minimum)

The active plan ships **Linear → Notion → Jira** in Phase 5. The rest are deferred until the first three are stable and there is real demand from an onboarded portco.

| # | Item | Why deferred | Promotion criteria |
|---|---|---|---|
| A1 | Asana connector (bi-directional) | Phase 5 already sequences 3 execution tools; adding 4th risks gate slip | A portco is on Asana + Linear/Notion/Jira coverage is stable for 30 days |
| A2 | GitHub Projects connector (push) | Engineering-only portcos can use Linear; GitHub Projects adoption uncertain | A portco uses GitHub Projects as primary execution tool |
| A3 | Monday connector | Lower adoption among portfolio | A portco standardizes on Monday |
| A4 | ClickUp connector | Same as Monday | Same |
| A5 | Confluence connector (read-only) | Most portcos use Notion; some use Confluence | A portco standardizes on Confluence + ≥ 50% of strategic context lives there |
| A6 | Salesforce deep-write (creating opportunities, tasks) | CRM-write is high-risk; CRM-read in Phase 5 is sufficient | Operator explicitly requests write capability + audit/rollback plan signed off |
| A7 | HubSpot deep-write | Same | Same |
| A8 | Pipedrive connector | Lower portfolio adoption | A portco uses Pipedrive as primary CRM |
| A9 | Zendesk / Intercom (support data → customer sentiment) | Adjacent to research mesh; not gate-critical | A portco wants support data influencing strategy |
| A10 | Mixpanel / Amplitude / Segment (product analytics) | GA4 covers basic; advanced analytics deferred | A portco needs product-led growth analytics as primary KPI source |
| A11 | Looker / Tableau / Mode (BI tools) | Direct warehouse access in Phase 5 covers most cases | A portco's BI layer has the strategic dashboards we'd otherwise rebuild |
| A12 | Calendar integration (Google / Microsoft) | Strategy work is async; calendar coupling deferred | Brainstorm scheduling becomes a real friction point |
| A13 | Email connector (Gmail / Outlook) | Risky surface; not core to strategy | Portco wants AI-summarized customer correspondence as research input |
| A14 | Discord / Microsoft Teams | Slack covers operator-tier embed | A portco standardizes on one of these instead of Slack |

---

# Section B · Public Data Sources (beyond Phase 1 minimum)

Phase 1 ships 6 sources. Additional sources land here.

| # | Item | Why deferred | Promotion criteria |
|---|---|---|---|
| B1 | Companies House (UK) | EDGAR covers US; UK adds when a portco is UK-based | UK portco onboarded |
| B2 | SEDAR (Canada) | Same logic | Canadian portco onboarded |
| B3 | EU registers (national + EU-level) | Regulatory analyst can fall back to web search | EU portco onboarded with regulatory complexity |
| B4 | Indian filings (MCA / SEBI) | Add when relevant | Indian portco onboarded |
| B5 | World Bank Open Data | FRED covers most macro; World Bank adds emerging-market depth | Strategy session involves emerging market for ≥ 30 mins |
| B6 | OECD / IMF data | Same | Same |
| B7 | Google Scholar / arXiv (academic) | Tech scout uses patents + GitHub; arxiv adds frontier research | Strategy involves frontier tech (AI, biotech, quantum) |
| B8 | SSRN (working papers) | Same as B7 | Same |
| B9 | Reddit / Twitter / LinkedIn (social listening) | Reviews + news cover most signal; social adds noise | A portco's strategy hinges on social sentiment |
| B10 | Glassdoor / Levels.fyi (talent + comp) | Talent analyst uses LinkedIn + Indeed + BLS | A portco's strategy hinges on talent dynamics |
| B11 | Satellite imagery (Planet / Sentinel) | High cost, narrow use | Portco strategy involves physical-world activity (retail, ag, logistics) |
| B12 | Apify / scraped review marketplaces (G2 / Capterra / Trustpilot beyond basic) | Basic in Phase 1; deep scraping adds cost/risk | Customer researcher needs longitudinal review analysis |
| B13 | BuiltWith / SimilarWeb / Wappalyzer (competitor tech stack) | Competitor analyst uses web fetch + filings | Strategy is in dev-tools / infra category |
| B14 | Product Hunt | Trend signal | Strategy involves consumer / prosumer market |
| B15 | App Store / Play Store reviews | Customer researcher Phase 1 covers basic | A portco has mobile-app primary product |
| B16 | Crunchbase / PitchBook (funding data) | Adds capital-market arena depth | Phase 3 simulation needs investor-side data more deeply |

---

# Section C · Frameworks (beyond Phase 3 library of 8)

Phase 3 ships 8 frameworks. Additional frameworks land here.

| # | Item | Why deferred | Promotion criteria |
|---|---|---|---|
| C1 | Real Options valuation (Black-Scholes adapted) | Phase 3 MCDA includes optionality scoring loosely; explicit RO model is heavier | A live decision hinges on quantified option value |
| C2 | Game-theoretic analysis (Nash, Stackelberg) | War-game in Phase 3 covers behavioral game theory; analytical solver is heavier | A pricing or bidding strategy needs analytical equilibrium |
| C3 | Scenario planning (Shell / GBN-style 2x2 matrices) | Phase 3 simulation produces scenarios; named methodology adds rigor | A long-range (5-10y) thesis is being built |
| C4 | Pre-mortem (Kahneman / Klein) — full ritual | Phase 5 includes pre-mortem; this is the full team-facilitated version | Multi-stakeholder pre-mortem is requested |
| C5 | OODA loop tracking (Boyd) | Strategy → Execution bridge in Phase 5 covers schedule drift; OODA adds tempo emphasis | A portco operates in fast-cycle competitive environment |
| C6 | Cynefin (Snowden) — domain classification | Diagnosis agent does this implicitly | An operator wants explicit complexity-domain naming |
| C7 | Hoshin Kanri (X-matrix) | OKR decomposition in Phase 5 covers similar ground | A portco operates in Japanese / lean-influenced culture |
| C8 | Balanced Scorecard (Kaplan-Norton) | OKRs cover; BSC adds 4-quadrant framing | A portco's board uses BSC format |
| C9 | Resource-Based View (Barney) | Capability mapping in Phase 5 covers; RBV adds VRIN framing | A capability-vs-market debate is unresolved |
| C10 | 7S framework (McKinsey) | Capability audit covers; 7S adds soft-system framing | An organizational-design question is in scope |
| C11 | Strategy Maps (Kaplan-Norton) | Visuals in Phase 4 cover BCG/3H/Wardley; Strategy Maps add causal-chain framing | A board memo needs strategy-map visual |
| C12 | Capability Maturity Model | Capability audit covers; CMM adds maturity scoring | A portco wants capability roadmap with maturity gates |

---

# Section D · Advanced Voice & Multimodal

| # | Item | Why deferred | Promotion criteria |
|---|---|---|---|
| D1 | Multi-participant voice (brainstorm with multiple humans in the room) | Phase 4 ships solo voice; multi-party needs speaker-diarization in realtime + UI for who-said-what | Two GP-firm members want shared brainstorm session |
| D2 | Emotion / prosody analysis (Hume integration) | Meridian explored; not adopted; deferred until clear value | A use case for emotional signal in strategy work emerges |
| D3 | Video understanding (Gemini long video) for earnings calls / town halls beyond transcription | Phase 1 transcribes; deep video understanding deferred | Portco has video-heavy strategic context |
| D4 | Generative video for scenario storytelling | Sora / Veo for "imagine this future" scenarios | Phase 7 portfolio briefings want video summaries (probably never, but recorded for completeness) |
| D5 | AR / VR strategy room | Vision Pro / Quest for spatial brainstorm | A team has the hardware and wants to try it |
| D6 | Custom voice cloning (your voice as briefing narrator) | ElevenLabs / similar | GP requests their own voice as briefing reader |
| D7 | Real-time translation (multilingual brainstorm) | International portco team brainstorms in non-English | International team request |
| D8 | Vision live (camera-in for whiteboard during voice session) | Phase 4 covers photo-upload of whiteboard; live camera is incremental | Whiteboard sessions become a primary brainstorm format |

---

# Section E · Computer Use & Agentic Browsing

| # | Item | Why deferred | Promotion criteria |
|---|---|---|---|
| E1 | Claude Computer Use for legacy systems | Most portcos use modern SaaS with APIs; computer-use is a fallback | A portco has a legacy system with no API and ≥ weekly strategic interaction needed |
| E2 | Operator-class agentic browsing | Tavily / Brave search + Playwright covers Phase 1-2; deep agentic browsing is heavier and pricier | A research question repeatedly needs interactive multi-page navigation that web_fetch can't handle |
| E3 | Browser extension (Chrome) for in-context strategy assistant | Adjacent to operator tier UX | Operators ask for in-browser assistant |
| E3a | Browser extension: right-click → "Apply this to portfolio" | Highest-leverage Share-and-Apply entry point if extension built. Defers because basic Share-and-Apply (Phase 2) covers paste/upload/URL — extension is convenience | Phase 4 Share-and-Apply usage shows ≥ 3× per week and friction from copy-paste is the dominant complaint |
| E4 | Mobile native app (iOS / Android) | PWA covers; native adds push, offline | GP or operator needs offline brainstorm capture |

---

# Section F · Advanced Learning & Calibration

| # | Item | Why deferred | Promotion criteria |
|---|---|---|---|
| F1 | Causal inference (proper, not "lite") with do-calculus / synthetic controls | Phase 6 ships causal-lite; full causal adds analyst-grade rigor | After 24 months of calibration data, full causal becomes feasible |
| F2 | Bayesian network for thesis dependencies | Drift detection in Phase 5 covers; BN adds joint probabilistic reasoning | A complex thesis has > 10 interlocking assumptions |
| F3 | Multi-armed bandit for strategic A/B (where applicable) | Most strategy is committed not optionable; MAB applies narrowly | A portco runs strategic experiments with quick feedback (pricing, packaging) |
| F4 | Counterfactual replay (re-run past projects with new memory) | Calibration shows what we predicted; counterfactual shows what we'd predict now | After Phase 6 matures, this becomes a learning amplifier |
| F5 | Federated learning across portcos | Privacy-preserving cross-co model improvement; complex | If pattern distillation isn't strong enough on its own |
| F6 | Active learning queue (system asks the questions it most needs answered) | Phase 6 auto-mines patterns; active queue adds explicit "I need data on X" | Calibration reveals systematic blind spots |

---

# Section G · Portfolio Operations

| # | Item | Why deferred | Promotion criteria |
|---|---|---|---|
| G1 | Cross-portco LP reporting auto-draft | Adjacent to GP workflow; not strategy-core | GP fundraising or LP reporting becomes a strategic priority |
| G2 | Capital allocation model (which portco gets follow-on?) | Touches investment decisions, not just strategy | A follow-on decision becomes recurring |
| G3 | Portco valuation tracker | Adjacent to strategy | GP wants valuation context in strategic decisions |
| G4 | Co-investor / syndicate intelligence | Outside core strategy | Strategy depends on syndicate dynamics |
| G5 | M&A target screening across portfolio | Phase 3 can do M&A screen per question; cross-portfolio screen is multi-co | A roll-up thesis is being built |

---

# Section H · Quality of Life

| # | Item | Why deferred | Promotion criteria |
|---|---|---|---|
| H1 | PWA install + push notifications | Web app covers; PWA adds polish | Operators on mobile request |
| H2 | Slack DM thread continuity (not just slash commands) | Phase 5 bot covers slash; thread continuity adds conversational depth | Operators use slash bot heavily |
| H3 | Voice commands beyond brainstorm ("read me the memo") | Brainstorm + briefing cover; ad-hoc voice commands add convenience | A real workflow needs it |
| H4 | Customizable dashboards | GP dashboard ships fixed in Phase 7; customization adds | GP wants different views than default |
| H5 | Template library (memo, board deck, OKR) | Briefing-default produces; templates add format variation | A specific format (e.g., for a known board) is needed |
| H6 | Multi-language UI | Self-use; English only | A portco team works in non-English |
| H7 | Dark mode / theming | Polish | After feature-complete |
| H8 | In-product video tutorials | Adjacent to docs | Operator onboarding friction emerges |

---

# Section I · Compliance & Enterprise Readiness (for future multi-tenant move)

These activate when transitioning from single-tenant self-use → external multi-tenant offering. Per principle P1, the system is **multi-tenant-ready** from day one; these items are the operational layer to actually ship to external customers.

| # | Item | Why deferred | Promotion criteria |
|---|---|---|---|
| I1 | SOC 2 Type II readiness | Self-use; not needed | First external customer in serious negotiation |
| I2 | GDPR data subject request automation | Self-use | EU external customer |
| I3 | HIPAA controls | Self-use; portcos aren't healthcare | Healthcare portco or external customer |
| I4 | Per-tenant LLM API key BYO | Currently shared keys per tenant | External customer wants to use own keys |
| I5 | Per-tenant model fine-tuning isolation | Hot-path distillation in Phase 4 is shared; isolation needed for true multi-tenant | First external customer |
| I6 | Self-serve onboarding flow | GP onboards portcos manually today | First external customer |
| I7 | Billing engine | Self-use, no billing | First external customer |
| I8 | Per-tenant SLA monitoring + breach reporting | Self-use | First external customer with SLA |
| I9 | Data residency (EU / India / etc.) | Self-use, single region | External customer requires |

---

# Section J · Speculative / Research-Tier

Items that are interesting but high-uncertainty.

| # | Item | Why deferred | Promotion criteria |
|---|---|---|---|
| J1 | Symbolic reasoning layer (Prolog / Datalog) on top of memory graph | Could improve consistency reasoning; unproven | A clear class of bugs emerges from LLM-only reasoning |
| J2 | Formal verification of strategic logic | Strategy isn't formally verifiable | Specific sub-domain (financial calc) needs it |
| J3 | Custom small-language-model trained on full portfolio corpus | Distillation in Phase 4 covers hot paths; full model is bigger | After 24 months of corpus accumulation |
| J4 | RLHF on GP's feedback to fine-tune agent style | Personality config in Phase 4 covers; RLHF adds | After 12 months of consistent GP feedback signal |
| J5 | Simulated user testing (synthetic operators stress-test strategy) | Adjacent to war-gaming | After Phase 7, if war-game arenas are mature |
| J6 | Strategy diff tool (compare two strategy versions side-by-side) | Adjacent to thesis versioning | When strategies are revised frequently enough |
| J7 | Strategy version control (git-like) | Memory has temporal validity, but explicit versioning is heavier | When formal revision tracking is requested |
| J8 | Knowledge distillation from public strategy literature (HBR, books, etc.) | Global memory in Phase 1 covers basics; deep distillation adds | After 12 months, if global memory feels thin |

---

# Section K · Things Considered and Explicitly Won't Build

Per principle compliance ([GUIDING_PRINCIPLES.md §3](./GUIDING_PRINCIPLES.md)). Listed here for completeness so they're not re-debated repeatedly.

| # | Item | Why won't build |
|---|---|---|
| K1 | Public marketplace for strategies / playbooks | P3 deliberate non-build: private only |
| K2 | Social features (share, comment, follow) | Same |
| K3 | Framework-picker UI as primary interaction | Violates P4 (diagnosis precedes frameworks) |
| K4 | Generic agentic chat (Replika-style) | Outside strategy platform scope |
| K5 | Real-time telemetry as primary surface | Strategy work is async; telemetry is supporting, not primary |
| K6 | Consumer SaaS pricing / billing engine | Self-use only |
| K7 | Full Excel replacement (spreadsheet engine) | Code interpreter + structured models suffice |
| K8 | CRM replacement | Integrate with existing |
| K9 | Project management replacement | Same |
| K10 | Email composition / send | Out of scope; integrate read-only if needed |
| K11 | Document storage as primary | We're not Notion / Google Drive |
| K12 | Calendar / meeting scheduling | Adjacent, not core |

---

# Section L · Items Promoted from Deferred → Active (changelog)

(empty — no promotions yet)

---

# Section M · Items Dropped from Deferred (changelog)

(empty — no drops yet)

---

# Document History

- **v1 · 2026-05-20** — Initial backlog. 12 sections (A-K active + L/M changelogs). Captures every item considered during master plan + debate that didn't make the active 8-phase plan, with promotion criteria for each. Won't-Build list locks in the deliberate non-builds per principles doc.

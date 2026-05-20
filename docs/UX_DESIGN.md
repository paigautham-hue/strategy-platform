# Strategy Platform — UX/UI Design Plan

> Companion to [GUIDING_PRINCIPLES.md](./GUIDING_PRINCIPLES.md) and [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).
> Every choice here is defensible against a principle (Pn / Hn) or a stolen, named pattern. If a future designer cannot trace a decision back to a principle, a reference, or a wow-moment in this doc, they should push back.

The product is a private, multi-company strategy platform where intelligence compounds. Two user tiers (GP / Operator), one backend. The UX must be **calm enough for daily use, dense enough for board-grade thinking, and magical enough that you reach for it before Notion or ChatGPT.** This document is the blueprint.

---

## 1 · Reference Set — the Design DNA

We are not blending influences randomly. Each reference is cited for a **specific borrowed mechanic**, not a vibe.

| Source | What we steal — specifically |
|---|---|
| **Linear** | Keyboard-first navigation; `cmd-K` as a universal verb-noun action launcher; "issue triage" pattern → our Synergy Candidates triage queue; quiet typography over chrome. |
| **Notion** | Modular block model — but only inside the **memo reading surface**. Each block (claim, chart, citation, quote, callout) is selectable, draggable, transformable. We do **not** copy Notion's empty-page-with-blinking-cursor; we always seed structure. |
| **Arc Browser** | "Spaces" per portco — each portco is a visual world with its own accent color, sidebar, and live tabs (active projects). Command bar swooping in from the top. Vertical project list. Pinned-on-top vs. today's-work distinction. |
| **Raycast** | The `cmd-K` palette grammar (verb → noun → modifier), fuzzy ranking, inline previews of the action result before commit, extension surfaces inside results. |
| **Things 3** | Whitespace as a feature. The *calm*. One thing in front of you at a time. The "Today" affordance — we mirror it as **"What needs your attention this week"** as the portfolio default landing. |
| **Stripe Dashboard** | Density without anxiety. Right-aligned numbers, tabular figures, sparkline-in-row, hover for drill-down. The "tabbed object detail" pattern → we use it on the Artifact Dashboard. |
| **Perplexity** | Numbered citations inline (`[1]`, `[2]`) with hover preview cards. Source pills clustered above answer. We extend this into our **Citation by Design** principle — every single claim is hover-cited. |
| **Claude.ai** | Conversational simplicity as the entry point. Long-form, reading-friendly responses. Artifacts panel split. We steal the **artifact-on-the-right, chat-on-the-left** split as the default Deep Research layout. |
| **Figma** | The canvas as a first-class surface for Brainstorm Map and the Knowledge Graph. Multi-select, lasso, comments anchored to nodes, observers' cursors (here: agent cursors during live research). |
| **Granola** | The "AI-augmented capture" silence — it listens, doesn't interrupt, structures after. Voice intake mirrors this: we **never** auto-commit voice; always draft → tray → confirm (also H3). |
| **Bloomberg Terminal** | Density-on-demand. A "pro mode" toggle (`cmd-shift-D`) that swaps the calm view for a high-density data view on the same surface — same data, different opacity of chrome. |
| **Apple Vision Pro / iOS 18** | Layered depth with light-blur backgrounds; the sense of one surface floating above another. We use translucent overlays for the Voice Mini-Player and the `cmd-K` palette; never opaque slabs. Materials matter. |
| **Tana / Reflect** | The knowledge graph as **navigable, not just visual**. Tana's "tuples" inform our dimensional tag display: instead of "tag soup," tags are shown as `dimension:value` pills (e.g., `geo:Brazil`, `horizon:H2`). |
| **Loom** | "Async briefing" framing for the daily voice briefing — chapter markers, transcript-on-the-side, speed controls, jump to "the part about portco X." |
| **Spotify** | The **return-to-where-you-were** affordance. Voice mini-player persists across navigation (H3). Recently played → recently visited projects/memos. "Wrapped" annual review of strategy patterns. |
| **Dieter Rams (10 Principles)** | "As little design as possible." Every surface starts at zero chrome and adds only what earns its presence. No decorative gradients. No purposeless animation. |
| **Jony Ive** | Material honesty — translucency means *layered information*, not just blur for blur's sake. Restraint in color. Single accent per surface. |
| **Michael Beirut / Pentagram** | Editorial typography. The Memo Reading Mode is **set like a magazine page**, not a SaaS dashboard. Serif body, sans display, generous leading. |
| **James Turrell** | Light as content. The agent activity view glows softly; finished agents fade to a calm steady-state hue. Color carries meaning, not decoration. |
| **Massimo Vignelli (NYC subway map)** | The Knowledge Graph is rendered as a **schematic**, not a force-directed mess. Lines have meaning, color codes are stable, the map is *for navigation*, not for impressing investors. |

---

## 2 · Design Principles

Twelve principles. Each is the answer to a specific recurring product question. Cite the number in code review.

**DP1 · Conversation is the universal entry.**
Every workflow — research, brainstorm, decomposition, war-game, briefing — can be started by typing or speaking a sentence. Forms exist only for structured artifacts (OKR editor, thesis editor). The Home view is one input field and the cursor blinks there. Tied to P4 (diagnosis precedes frameworks).

**DP2 · Show the work.**
The agentic process is not hidden behind a spinner. The Live Deep Research surface streams every agent's status, sources gathered, partial findings, and reasoning chain. This is both UX (trust) and pedagogy (the GP learns the system's reasoning). Tied to H9 (provenance on every claim).

**DP3 · Citation by design.**
Every claim — in a memo, on a graph node, in a war-game transcript — is hoverable to its source. There is no "click to expand" or "view sources" tab; provenance is a first-class property of the text itself. Implements H9.

**DP4 · Calm by default, dense on demand.**
The default state is uncluttered, magazine-like, single-task. A `cmd-shift-D` toggle reveals density (data tables, raw metrics, all dimensions). The user chooses the moment. Density is never punishment. Riff on Stripe + Things 3.

**DP5 · Voice is first-class, not bolted on.**
Voice has its own UI grammar (mini-player, persona indicator, draft tray) and is reachable from every surface via the keyboard `cmd-.` or the persistent mini-player. Brainstorm Mode is voice-native; the keyboard version is the fallback, not the reverse. Tied to P7 and H3.

**DP6 · The knowledge graph is approachable, not Obsidian-overwhelming.**
Default view is a schematic (Vignelli), not a force layout. Filters (by dimension, by horizon, by confidence) come first; visual exploration comes second. Three default lenses: **Capability map** / **Competitive map** / **Decision map**. Never present the full graph cold.

**DP7 · Two tiers, one feel.**
The Operator tier (Slack/Notion/Linear embed + simplified web) shares typography, color, voice, motion language with the GP tier. An operator opening the web app should feel "this is the same product, lighter." No reskin; just fewer surfaces. Tied to P7.

**DP8 · Motion has meaning.**
Movement signals causality, not decoration. A synergy detected pulses two stars in the constellation; an agent finishing fades from amber to green; a memo regenerating wipes its old content with a downward shimmer. Reduced-motion mode preserves the **causality** via color/position changes, drops the *motion*. Riff on Apple HIG.

**DP9 · The system has a confidence posture.**
Every artifact wears its confidence visibly — not as a percentage in a corner, but as **typographic weight, color saturation, and language**. High confidence: bold, saturated, declarative. Low confidence: lighter weight, desaturated, hedged language. The user reads tone, not just numbers. Tied to H9.

**DP10 · Multi-company namespacing is felt, not just enforced.**
Each portco has an **accent color**, a **stable letterform monogram**, and a **persistent breadcrumb at top-left**. You always know which portco's data you are looking at; cross-company surfaces (synergy, briefing) explicitly show **multiple accent colors**. Implements P1 visually.

**DP11 · No empty states without a suggested next action.**
Every blank surface — no projects yet, no memos yet, no closed predictions yet — offers 2-3 starter actions appropriate to the user's tier and stage. The product never makes the user invent the next move.

**DP12 · Briefing-default is a UX promise.**
The first thing the user sees after any deep workflow is **one page**. Deeper layers (full doc, model, scenario tree, playback) are explicit choices reached via a `Go deeper` strip at the page bottom — never via collapsed accordions or "load more." Implements H6.

---

## 3 · The "Wow" Moments

Twelve specific, named UX moments. Each is a defensible design artifact, not a feeling.

1. **First voice intake → Diagnosis reframe (Phase 0/1).** User speaks a question for 20 seconds. The transcript types itself out left-aligned. Then, with a 600ms delay, the **reframed question** types itself below, in serif italics, with the original strikethrough above in 40% opacity. A subtle chime (a low E-major triad, 200ms) marks the reframe. The user feels: *"It listened, then it pushed back."*

2. **Live agents working (Phase 2).** When deep research kicks off, the screen splits: chat-left, **agent activity tree right**. Each agent is a node that glows amber while running, with a live count of sources gathered ticking up in real time. As findings land, citation pills slide down into a "Findings" rail at the bottom. When all agents complete, a 1.2s ease-out sweep collapses the tree into a single **"8 agents · 47 sources · $3.21"** summary chip. *Claude-Research, but yours.*

3. **The reframed-question typewriter.** Diagnosis output never appears suddenly. It types itself in, character by character, at ~80 wpm — slow enough to feel deliberate, fast enough not to be annoying. This is the only place we use a typewriter effect. It says: *"the system is thinking, not retrieving."*

4. **Citation hover-card.** Hovering any claim raises a 320px-wide card with: source title, publication date, a 3-line excerpt highlighting the matched passage, the agent who pulled it, the confidence score as a 5-bar meter. Card has a translucent vision-pro-style background. Tab from card to card with arrow keys. Press `c` to copy the cite.

5. **Brainstorm Mode phase transition.** During a voice brainstorm, when the AI detects the user has shifted from Diverge → Probe phase, the **screen background hue subtly shifts** (cool blue → warmer cyan), a single chime plays, and the persona's indicator pill updates. No interruption, no modal. The phase shift is *felt* in peripheral vision.

6. **Persona swap mid-voice.** User says: *"Let me hear from the regulator."* Within 1.5s: the voice timbre changes (different ElevenLabs voice), the persona avatar pill in the mini-player rotates with a 3D card flip (300ms), and a soft "new speaker" tone plays. The conversation continues without a session drop. Steals from Granola's silence + Spotify's transition crossfade.

7. **Synergy detected — the constellation pulse.** On the Portfolio Dashboard's constellation view, when Synergy Scout finds a new high-confidence candidate, two portco stars **draw a connecting arc** with a 1.6s ease-out, the arc pulses three times at 0.8Hz, and a Synergy Card slides in from the right rail. A single notification tone (a soft B5, 180ms). The first time this fires, an onboarding caption appears once: *"Two of your companies just got more interesting together."*

8. **The Knowledge Graph "Vignelli zoom."** Zoom out far enough and the graph snaps into a **schematic transit-map layout** (orthogonal lines, color-coded by dimension). Zoom in and it morphs back into a spatial layout with curved edges. The morph is a single 800ms transform — not progressive. *Two views, one gesture.*

9. **War-Game playback — the radio drama.** The war-game playback view is intentionally cinematic: a dark stage, persona avatars in a horizontal row, the active speaker glows, transcript scrolls below in service serif, audio plays with a waveform under the active avatar. Spacebar pause. `→` skip turn. `j` / `k` jump persona. Borrows from Loom's chapter UI + a podcast player.

10. **Calibration scorecard reveal — the "you got smarter" moment.** Monthly, the platform generates a calibration card showing per-framework and per-agent accuracy delta vs. last month. The card has a single **sparkline that draws itself in 1.4s**, ending on the latest point with a subtle green/red dot. A one-line plain-English summary on top ("Wardley calls are 12% better this quarter; Porter is flat"). No bar chart vomit. *Spotify Wrapped energy, monthly.*

11. **Voice Briefing morning entry.** Opening the app between 6am–10am local: a soft, full-bleed gradient (the portfolio's collective accent colors) fills the top 30% of the screen with a single line: *"Good morning. 4 things changed overnight. 7 minutes."* and a large play button. Hitting play starts the daily briefing in the mini-player, transcripts on the right, chapter markers visible.

12. **Memo regenerate — the shimmer.** When the user clicks "regenerate this section," the old text dissolves with a top-down shimmer wipe (400ms), the new text types in below at a faster pace than the diagnosis (slightly under 200 wpm), and any changed citations highlight in a 600ms yellow pulse. The user sees *exactly what changed*.

---

## 4 · Information Architecture + Navigation Model

### Top-level structure

```
GP TIER                                    OPERATOR TIER
─────────────────────                      ───────────────────
Portfolio Overview          ───┐           Today (their portco only)
  └─ Briefing                  │              ├─ Voice intake
  └─ Synergy Queue             │              ├─ Active projects
  └─ Calibration               │              ├─ Drift alerts
Portcos (each its own Space)   │              └─ Slack/Notion shortcuts
  ├─ Projects                  │
  │   └─ Sessions              │           (no Portfolio, no Synergy,
  │       └─ Artifacts         │            no Calibration access)
  ├─ Knowledge Graph           │
  ├─ Execution Dashboard       │
  └─ Memory Browser            │
Global Memory (read-only) ─────┘
Settings · Cost · Audit
```

### The four navigation primitives

**(a) Spaces — one per portco (Arc-style).**
Each portco is a Space. Switching Spaces (`cmd-O`, then portco name) **swaps the entire sidebar, accent color, and breadcrumb root** but preserves your scroll position and any open artifact. Spaces have a fixed left rail with: Projects, Knowledge Graph, Execution, Memory. Portfolio is a *meta-Space* with its own rail.

**(b) Command Palette — `cmd-K`.**
Verb-noun grammar (Raycast pattern). Top entries:
- `Ask…` → opens new conversational input scoped to current Space
- `Brainstorm…` → starts voice brainstorm
- `Go to…` → fuzzy switch to any project/session/memo across the portfolio
- `Compare…` → opens side-by-side compare of two artifacts or two portcos
- `New project / memo / war-game / briefing`
- Inline previews: hovering a result in `cmd-K` shows a 240px preview pane on the right.

**(c) Quick Switcher — `cmd-O`.**
Strictly for *navigation*: portco / project / session / memo. Recently visited first (Spotify pattern). No actions, only jumps.

**(d) Tab strip — top of each Space.**
Each open project/artifact is a tab (Arc-style vertical tab list in the sidebar; horizontal tab strip option). Tabs persist across browser sessions. **Pinned tabs** (always-on, e.g., the live briefing) live above an `── ── ──` divider; today's working tabs below. Side-by-side: drag any tab onto another to split-view.

### Breadcrumb pattern

Top-left, always: `Portfolio › Portco-Acme (accent dot) › Q3-Pricing › Session 04 · Brainstorm`
Each segment is clickable, each shows a hover-preview of its children. The portco segment carries its accent color dot.

### Mobile / PWA fallback

Mobile is **voice-first + read-only memos + briefing playback + drift alerts**. No graph editing, no canvas, no war-game playback (link to desktop). The mobile app's home screen is essentially the Daily Briefing player with a microphone button. This honors the "operator embedded in real tools" principle — the mobile web is for capture and consumption, not authoring.

### Voice mini-player persistence

The mini-player (Meridian pattern, H3) is **always at bottom-right** when a voice session is active. Shows: current persona avatar, brainstorm phase, mute toggle, hang-up, expand-to-full-overlay. It survives all navigation, all Space switches. `isCallActive` and `isOverlayOpen` are decoupled.

---

## 5 · Surface-by-Surface UX Spec

For each surface: layout, key interactions, and at least one specific borrowed pattern.

### 5.1 Conversational Home

**Layout:** Centered single input field, 720px max-width, 80vh down the page. Above the input: a single line — *"What's on your mind?"* (or, time-aware: *"Continuing on Acme pricing?"*). Below: 3 ghost suggestion chips (recent threads, today's briefing, drift alerts). No nav. Sidebar collapses on Home.
**Interaction:** Hit `enter` to type-ask; hit `space-hold` or click mic to voice-ask. Esc returns to last project.
**Borrows from:** Claude.ai / ChatGPT entry, but with a calmer Things-3 horizon line.

### 5.2 Live Deep Research

**Layout (split):** Left 55% — conversational thread (questions, agent narration in muted voice, partial findings). Right 45% — **Agent Activity Tree**: ChiefStrategist at top; specialists branching below; each shows name, status (queued/running/done/killed), sources gathered count, elapsed time, $ spent. Bottom rail: Findings (citation pills as they land, draggable into the memo).
**Interaction:** Click any agent → see live reasoning chain. Click any finding → see source. Drag a finding → pin to memo. `cmd-period` → pause all. Inline steering: type into the thread mid-run; chief strategist re-plans.
**Borrows from:** Claude Research; Linear's parallel activity feed.

### 5.3 Brainstorm Mode

**Layout:** Dark background (it's a thinking surface). Center: phase indicator strip — Diverge · Probe · Sharpen · Lock — one is highlighted. Persona avatar pill top-right. Waveform across the bottom. Below the waveform: a live "captures" rail (5 columns: Hypotheses / Options / Assumptions / Risks / Open Qs) where extracted items appear as cards in real time.
**Interaction:** Voice-driven. Press space to mute mid-thought. Phase transitions auto-detected; user can manually advance with `shift-→`. End session → opens the Draft Tray (see 5.4 sibling).
**Borrows from:** Granola (silent capture), Figma (canvas-as-thought).

### 5.4 Artifact Dashboard (per session)

**Layout:** Tabbed object detail (Stripe Dashboard pattern). Tabs across the top: **Memo · Options · Frameworks · War-Game · Chat · Sources**. Default tab = Memo (per H6).
**Interaction:** Tabs preserve scroll. `cmd-1..6` to switch. Right-rail: persistent "Go deeper" strip with the 3 deepest derivative actions for this artifact.
**Borrows from:** Stripe + Claude.ai artifact panel.

### 5.5 Strategic Knowledge Graph

**Layout:** Default = three lenses as toggle pills at the top: **Capability** · **Competitive** · **Decision**. Each lens loads a Vignelli-style schematic by default. Zoom in switches to spatial. Right rail: filters (dimensions as `dim:value` pills), confidence slider, time window.
**Interaction:** Click node → drawer slides from right with memory items, related claims, citations. Drag two nodes together → "compare" view. `g + g` to zoom-to-fit.
**Borrows from:** Vignelli + Tana (tuple-tag pills) + Figma (selection).

### 5.6 Strategy → Execution Dashboard

**Layout:** Top — strategy thesis as a one-paragraph callout. Middle — Initiatives as 3-5 cards in a horizontal row; each shows objective, top 2 KRs, status sparkline, drift indicator (a circular gauge: schedule / KPI / thesis drifts as three sectors), confidence wear. Bottom — Tasks table synced from Linear (with Linear's exact issue look, intentionally familiar).
**Interaction:** Click initiative → opens decomposition tree. Drift gauge red → click for replan suggestions (Continue / Adjust / Pivot / Kill cards). Click any KR → opens its KPI source data.
**Borrows from:** Linear (tasks table), Stripe (sparkline-in-row).

### 5.7 Portfolio Dashboard (GP only)

**Layout:** Hero = **Portfolio Constellation** — each portco a star, sized by capital allocated, colored by its accent, position by 2D thesis-health × momentum. Lines between stars = active synergies. Below hero: "What needs your attention this week" — a 5-item triage list (drift alerts, calibration deltas, pending synergies, predictions closing, briefing). Right rail: portfolio thesis (editable, GP only).
**Interaction:** Hover a star → portco snapshot card. Click → enter that Space. Click a synergy line → opens Synergy Card.
**Borrows from:** Bloomberg Terminal (density), Apple Vision Pro depth, Vignelli schematic for the constellation positioning.

### 5.8 Synergy Candidates Queue

**Layout:** Linear-style triage list. Each row: detector type (icon), portcos involved (their monograms in accent colors), one-line claim, evidence count, confidence bar, suggested next action. Right rail = detail of selected candidate.
**Interaction:** `e` to escalate, `d` to dismiss, `p` to publish (action becomes available to operators). Bulk-select with `x`.
**Borrows from:** Linear triage view.

### 5.9 Calibration Scorecard

**Layout:** A single editorial page (Beirut/Pentagram). Top: one sentence summary. Below: a leaderboard table (framework / agent / model) with hit rate, change vs last period, sample size. Sparklines per row. Bottom: 2-3 "what changed" narrative paragraphs auto-drafted by the system, each with citations to the predictions that drove the delta.
**Interaction:** Click a row → see the underlying closed predictions. `r` to refresh.
**Borrows from:** Stripe (table), magazine layout.

### 5.10 Voice Briefing Player (podcast-like)

**Layout:** Full-bleed top hero with portfolio accent gradient. Center: large play button, total duration, chapter markers below the scrubber. Right rail: full transcript with citation pills. Left: chapter list ("Acme — pricing drift," "Beta — synergy candidate," etc.).
**Interaction:** Spacebar play/pause. `→ / ←` chapter skip. Click any transcript line → jump audio. `?` opens follow-up voice question (returns to mini-player).
**Borrows from:** Loom + Spotify + a clean podcast app.

### 5.11 War-Game Playback

**Layout:** Cinematic dark theater. Persona avatars across the top row (4-6), active one enlarged with a soft halo. Transcript scrolls below in serif. Audio waveform under active speaker. Scenario context pinned bottom-left.
**Interaction:** Spacebar pause. `j/k` jump turn. `1..6` jump to persona. End screen: outcome summary card + "Add a war-game prediction to ledger" CTA.
**Borrows from:** Podcast app + radio drama. Tied to P3's TTS playback.

### 5.12 Memo / Output Reading Mode

**Layout:** Magazine. Serif body (Source Serif or Tiempos), 680px column, generous leading (1.6). H1 in display sans. Pull quotes for high-confidence claims. Inline citations as superscript pills. Sidebar (collapsible): table of contents, citation rail, confidence summary.
**Interaction:** Select any text → comment / regenerate / cite-here. `cmd-shift-D` → density mode (raw data tables expand inline). `cmd-shift-X` → export (PDF, Notion, Slack, board-deck PPTX).
**Borrows from:** Pentagram editorial, Notion blocks (only on selection), Perplexity citation pills.

### 5.13 Operator-Tier Surfaces

- **Slack bot:** `/strategy ask`, `/strategy status`, `/strategy brief`. Replies use Slack's rich-text blocks; 1-page memo is a Slack canvas link with preview. Daily digest as a 4-line message.
- **Notion sidebar:** A pinned page in their workspace. Shows their assigned portcos, active initiatives, and a "voice intake" launcher (deep-links to web).
- **Linear integration:** Strategy context appears as a pinned issue or as a comment on synced tasks; AI-generated weekly status pulls from Linear updates.
- **Operator web home:** Same typography, same accent colors, but one column. Voice intake button at the top. Projects list. Drift alerts. No portfolio, no synergy, no calibration.
- **Email digest:** Weekly board-ready 1-pager — magazine-styled HTML email; click-through deep-links to read-only memo.

---

## 6 · Design System

### 6.1 Typography

Two faces. No more.

| Role | Face | Notes |
|---|---|---|
| **Display & UI** | **Inter** (variable) | Used for all UI chrome, headers, labels. Inter's tabular figures are critical for Stripe-density numbers. |
| **Editorial body** | **Source Serif 4** (variable) | Memo body, war-game transcript, briefing transcript. Magazine setting (1.6 leading, 17px). |

Monospace **only** for: cost figures, IDs, citation hashes, code blocks → **JetBrains Mono**.

We deliberately avoid GT America, Söhne, etc. — Inter ships free, variable, has the widest weight range, and reads cleanly at small sizes. Tabular alternates are non-negotiable for the Stripe-density surfaces.

### 6.2 Color

Dark mode is default. Light mode is supported, not first. Both pass WCAG AA.

**Foundation (dark mode default):**

| Token | Hex | Use |
|---|---|---|
| `bg-base` | `#0B0D10` | Page background |
| `bg-raised` | `#13161B` | Cards, panels |
| `bg-overlay` | `#1B1F26` | Modals, palette |
| `border-subtle` | `#22262E` | Hairline dividers |
| `text-primary` | `#E8EAED` | Body |
| `text-secondary` | `#A0A6B0` | Meta, labels |
| `text-tertiary` | `#6B7280` | Captions |

**Semantic colors:**

| Token | Hex | Use |
|---|---|---|
| `accent-portfolio` | `#7C9CFF` | Portfolio (cross-portco) surfaces |
| `signal-positive` | `#5BD2A0` | KR on-track, calibration improved |
| `signal-warning` | `#F4C065` | Drift detected |
| `signal-critical` | `#F47C7C` | Thesis invalidated, hard kill |
| `signal-info` | `#7CC4F4` | Citations, hover |

**Dimensional tag colors** (stable, semantic — used in Knowledge Graph + tag pills):

| Dimension | Hex | Mnemonic |
|---|---|---|
| Market | `#9B7CF4` | Violet — abstract structure |
| Segment | `#F47CC4` | Pink — people clusters |
| Product | `#7CF4C4` | Mint — what is built |
| Geo | `#F49B7C` | Coral — places |
| Channel | `#7CF49B` | Lime — flow |
| Tech | `#7CC4F4` | Sky — infrastructure |
| Capability | `#F4E47C` | Gold — strength |
| Framework | `#C4F47C` | Chartreuse — lens |
| Horizon | `#A0A6B0` | Grey — time |

**Portco accents:** each portco is assigned one of 12 reserved accent hues on creation (user can re-pick). The accent shows in: breadcrumb dot, sidebar rail, monogram tile, constellation star.

### 6.3 Spacing & Grid

- **Base unit:** 4px. Spacings: 4, 8, 12, 16, 24, 32, 48, 64, 96.
- **Grid:** 12-column at desktop, 8-col tablet, 4-col mobile. Gutters 24px desktop.
- **Reading column:** 680px max for memos. Dashboard panels max 1280px before scaling.
- **Padding rule:** outer page padding scales with viewport; inner card padding stays constant (16/24).

### 6.4 Iconography

**Lucide** as primary (large coverage, consistent stroke). Custom icons only for:
- Portco monograms (auto-generated wordmark per portco — 2 letters, accent-colored)
- Persona avatars (set of 12 abstract shapes — not faces, never faces; faces would be uncanny)
- Brainstorm phase icons (4 custom glyphs for Diverge / Probe / Sharpen / Lock)
- Dimension icons (one custom glyph per dimension, matching the dimension's color)

### 6.5 Motion Language

| Use | Duration | Easing |
|---|---|---|
| Hover state | 120ms | ease-out |
| Panel slide-in | 240ms | ease-out-cubic |
| Modal / palette open | 180ms | ease-out |
| Diagnosis typewriter | ~80 wpm | linear |
| Memo regenerate shimmer | 400ms wipe + 600ms pulse | ease-in-out |
| Constellation synergy arc | 1600ms draw + 3× pulse | ease-out |
| Graph schematic ↔ spatial morph | 800ms | ease-in-out-cubic |
| Persona swap card flip | 300ms | ease-in-out |
| Phase transition hue shift | 1200ms background lerp | linear |

**Reduced motion:** the *causality* survives — color/position changes happen instantly, just without the easing tween. Synergy arc still appears; it just doesn't animate.

### 6.6 Sound Design

Subtle. Never musical. Each ≤ 250ms.

| Event | Sound |
|---|---|
| Diagnosis reframe complete | Low E-major triad (200ms) |
| Brainstorm phase shift | Single soft chime (180ms) |
| Synergy detected (first time per session) | Soft B5 bell (180ms) |
| Persona swap | Brief pitch glide (220ms) |
| Agent batch complete | Subtle "click-up" affirmative (120ms) |
| Error / hard kill | Single low thud (150ms) |
| Voice mute toggle | iOS-style click |

All sounds default-on for voice surfaces, default-off elsewhere. One global mute (`cmd-shift-M`).

### 6.7 Component Library Inventory

The components below are first-class and reused across surfaces. Each is a named module.

| Component | Used in |
|---|---|
| `CommandPalette` | Global (`cmd-K`) |
| `QuickSwitcher` | Global (`cmd-O`) |
| `VoiceMiniPlayer` | Global (when voice active) |
| `BreadcrumbWithPortcoDot` | Top-left of every Space |
| `SourcePill` | Inline citations, citation rails |
| `ClaimCardWithCitationHover` | Memo, graph nodes, transcripts |
| `AgentActivityTree` | Live Research |
| `BrainstormCapturesRail` | Brainstorm Mode |
| `BrainstormMapNode` | Brainstorm Map (Figma-style canvas) |
| `PortcoMonogram` | Constellation, breadcrumbs, switcher |
| `PortfolioConstellation` | Portfolio Dashboard |
| `DriftGauge` | Strategy→Execution, initiative cards |
| `CalibrationSparkline` | Calibration Scorecard, initiative cards |
| `OKRCard` | Strategy→Execution |
| `InitiativeCard` | Strategy→Execution |
| `VoiceWaveform` | Mini-player, Brainstorm, War-Game |
| `PersonaAvatarPill` | Voice surfaces, War-Game |
| `DimensionTagPill` | Memory browser, Graph filters, claim cards |
| `ConfidenceMeter` (5-bar) | Citation cards, claim cards |
| `GoDeeperStrip` | Bottom of every briefing-default surface |
| `PhaseIndicatorStrip` | Brainstorm Mode |
| `CostChip` | Live research, session summaries |
| `SynergyCard` | Synergy Queue, portfolio constellation |
| `ContradictionEdge` | Contradiction Review, Graph |
| `LensToggle` | Knowledge Graph (Capability/Competitive/Decision) |
| `DensityToggle` | Every dashboard (`cmd-shift-D`) |
| `RegenerateShimmer` | Memo, output surfaces |

---

## 7 · Navigation Patterns

### 7.1 Command Palette (`cmd-K`) — what's in / what's out

**In:** Verbs (Ask, Brainstorm, Compare, New, Open, Run, Export, Switch persona, Switch portco, Cite, Pin, Resolve, Dismiss, Publish, Replan).
**Out:** Settings, account, billing (these live in Settings; cmd-K is for *work*, not config).

### 7.2 Quick Switcher (`cmd-O`)

Strictly navigation. Recently visited (Spotify pattern) first; fuzzy match second. Portco / Project / Session / Memo only.

### 7.3 Voice Command Vocabulary

Reserved voice verbs (the system parses these as commands, not content):
- *"Capture that as a hypothesis / option / risk / assumption / open question"*
- *"Let me hear from [persona]"* → persona swap
- *"Move to probe / sharpen / lock"* → phase advance
- *"Pin this"* / *"Pin that source"*
- *"Pause" / "End session" / "Recap that"*
- *"Cite the [source]"*
- *"Compare with [portco/project]"*

All other speech is content. The reserved list is documented in-product (`?` opens cheat sheet).

### 7.4 Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `cmd-K` | Command palette |
| `cmd-O` | Quick switcher |
| `cmd-.` | Toggle voice mini-player (start / end voice session) |
| `cmd-/` | Inline help / shortcut cheat sheet |
| `cmd-shift-D` | Density toggle |
| `cmd-shift-M` | Global mute (sound) |
| `cmd-shift-S` | New synergy candidate (GP only) |
| `cmd-shift-B` | Start brainstorm |
| `cmd-shift-R` | Start deep research |
| `cmd-shift-X` | Export current artifact |
| `cmd-1..6` | Switch Artifact Dashboard tab |
| `cmd-[` / `cmd-]` | Back / forward in nav stack |
| `g g` | Zoom to fit (graph / canvas) |
| `j` / `k` | Jump turn / persona (war-game, briefing) |
| `e` / `d` / `p` | Escalate / dismiss / publish (synergy queue) |
| `?` | Surface-specific help |

### 7.5 Mobile Gestures

- Tap microphone → push-to-talk
- Swipe down on briefing → minimize to mini-player
- Long-press citation → preview card
- Swipe-right on drift alert → snooze
- Two-finger pinch on graph → zoom; double-tap → snap to schematic

### 7.6 Persistent vs Modal vs Ephemeral

- **Persistent:** Sidebar, breadcrumb, voice mini-player, cost chip, sync status dot.
- **Modal:** Command palette (`cmd-K`), confirmation of destructive action (kill agent batch, dismiss synergy), pre-mortem ritual.
- **Ephemeral:** Toasts (3s), citation hover-card, persona swap notification, sound cues.

We refuse modal dialogs that block other work. Confirmations are always single-click recoverable for 5s ("Undo" toast).

---

## 8 · Accessibility

Target: **WCAG 2.2 AA**, with select AAA where free (color contrast on body text).

| Requirement | How |
|---|---|
| Keyboard navigation everywhere | Every interactive element reachable by tab; focus ring uses `signal-info` cyan, 2px offset. No keyboard traps. |
| Screen reader | Memos read top-to-bottom in source order; citations announced as *"citation N to [title]"*; agent activity tree exposed as a live region with throttled updates; calibration sparklines have data tables behind them. |
| Color contrast | Dark-mode body ≥ 7:1; UI labels ≥ 4.5:1; non-text indicators (drift gauge, confidence meter) **never** rely on color alone — pair with shape (gauge fill %), text, or pattern. |
| Reduced motion | Honors `prefers-reduced-motion`; durations collapse to 0–80ms; causality preserved via state change. Constellation pulses become a single discrete state. |
| Voice as accessibility win | Operators with low vision or limited mobility can complete an entire strategy intake → memo loop via voice + briefing playback alone. Full keyboard-only path is also complete. |
| Captions | War-game playback and voice briefing both have synchronized captions, always on by default. |
| Font sizing | All sizes use relative units; respects browser zoom up to 200% without layout break. |

---

## 9 · Onboarding UX (first 5 minutes)

### GP Onboarding — "First useful output ≤ 5 min"

1. **Min 0:00** Land on a single screen: *"Let's set up your first portfolio company. What's it called?"* — voice or type. (DP11: no empty home.)
2. **Min 0:30** Three quick fields: name, sector, geography. Auto-suggest from public sources.
3. **Min 1:00** Drag-and-drop prompt: *"Drop a board deck, last financials, or your top 3 strategic docs. I'll do the rest."* — or skip with voice intake.
4. **Min 1:30** Vision/ingest runs (Phase 1); progress shown as the Agent Activity Tree (early reuse of the same component). Cost chip visible.
5. **Min 3:00** First Knowledge Graph appears, populated with ≥ 20 memory items. A guided callout points to one node: *"Here's what I learned. Click any claim to see the source."*
6. **Min 4:00** Suggested next action: *"Want me to brainstorm a Q3 strategic question with you?"* — one-click into Brainstorm Mode.
7. **Min 5:00** A 1-page memo is rendered from the brainstorm (briefing-default). First useful output.

### Operator Onboarding — "First useful output ≤ 5 min"

1. **Min 0:00** Receives Slack invite or magic link. Lands on operator web home.
2. **Min 0:30** Sees their assigned portcos (already populated by GP). Single onboarding card: *"Ask me anything about [Portco]. Voice or type."*
3. **Min 1:00** Optional: connect Slack/Linear/Notion (one-click OAuth). Skippable.
4. **Min 1:30** Voice intake button highlighted. Operator asks a real question.
5. **Min 3:00** 1-page memo lands. Cite-hover demonstrated via single tooltip on first claim.
6. **Min 4:00** Inline next action: *"Want me to push this to Slack as a thread, or save to Notion?"*
7. **Min 5:00** Done. They have a memo, a saved location, and know the voice button. No tour.

Both flows: skippable at any step. The voice intake button is **always present** as the universal fallback.

---

## 10 · Frictionless Friction-Points Checklist (Anti-Patterns We Refuse)

- No modal dialogs that block work. Confirmations are toasts with `Undo` for 5s.
- No loading spinner over 2s without a progress message and an estimate.
- No empty state without a suggested next action.
- No required form field without an inline explanation of *why*.
- No "framework picker" dropdown (P4). Diagnosis selects frameworks.
- No alert badge counter without an actionable click target underneath.
- No success toast for routine actions (saving a memo, sending a message). Save state is shown via a `Saved · 2s ago` chip, not a celebration.
- No auto-play audio (briefing requires an intentional play).
- No 5+ click paths to any feature. If `cmd-K` doesn't reach it in 2 strokes, we re-architect.
- No tooltips substituting for legibility. If a label needs explanation, the label is wrong.
- No notification we cannot snooze, mute, or unsubscribe from in-place.
- No voice command we don't echo back as text confirmation (Granola pattern).
- No artifact that doesn't carry its `prediction_id` and `confidence` (H7, H9).
- No surface that doesn't honor `prefers-reduced-motion`.
- No copy that says "AI" gratuitously. The system is the *strategy platform*; the underlying tech is implementation detail.

---

## 11 · The "Signature"

Five details that make this product distinctly itself. The Spotify-green of strategy platforms.

1. **The Diagnosis Typewriter.** Every reframed question types itself in, in serif italic, with the original strikethrough above. This is the platform's "hello." It is used nowhere else; nothing else types. *Signature behavior.*

2. **The Portfolio Constellation.** A schematic star map where each portco is a star, colored by its accent, sized by allocation, positioned by thesis-health × momentum. Synergies are drawn arcs. This is the platform's iconic image — the screenshot that goes on the splash page. *Signature visual.*

3. **The Dimensional Tag Pill.** `dim:value` pills in stable colors (Tana-inspired tuples). Always rounded, always two-tone (dimension hue + value text). They appear on every memory item, every claim, every filter. *Signature primitive.*

4. **The "Go Deeper" Strip.** The persistent footer on briefing-default surfaces. One line, three actions, always there. It encodes the entire briefing-default policy (H6, DP12) into a single visual habit. *Signature pattern.*

5. **The Calm Dark, Editorial Body.** The combination of `#0B0D10` background, Inter UI chrome, and Source Serif memo body produces a feel that is neither SaaS nor terminal nor consumer app. It is a **library at night** — quiet, considered, grown-up. *Signature mood.*

If a user, shown five screenshots out of context, can identify this product, these five details are why.

---

## 12 · Implementation Phase Mapping

UX deliverables mapped to the 8 phases from `IMPLEMENTATION_PLAN.md`. Phases 0-3 are functional; Phase 4 is the UX inflection; Phase 7 is the wow.

| Phase | UX deliverables | Polish level |
|---|---|---|
| **0 · Foundation** | Functional Company switcher, Cost dashboard, Audit log viewer, basic Settings. Design tokens established. Component library v0: `Breadcrumb`, `SidebarRail`, `CostChip`. | Functional — establish tokens, defer animation. |
| **1 · Memory + Ingest** | Conversational Home (text), basic Knowledge Graph (single lens), Voice Intake (one-shot Meridian pattern), Portco Onboarding wizard, Memory Browser. Component library v1: `SourcePill`, `ClaimCardWithCitationHover`, `DimensionTagPill`, `VoiceWaveform` (basic). | Calm baseline. First wow: citation hover-card. |
| **2 · Diagnosis + Research** | **Diagnosis Typewriter (signature)**, Live Deep Research split view, `AgentActivityTree`, Contradiction Review, Source Inspector. Density toggle introduced. | First true wow: live agents working. |
| **3 · Reasoning + Simulation** | Artifact Dashboard (tabbed), Memo Reading Mode (editorial typography lands here), War-Game Playback (cinematic), Framework visualizations (Wardley/Porter/BCG/3H), Cross-Co war-game UI (GP-only). | Editorial polish lands. **Defensible alpha** UX bar. |
| **4 · Brainstorm + Voice (PEAK UX)** | **Brainstorm Mode (all 4 phases visualized)**, Realtime voice with mini-player, Persona swap with card flip, Multimodal drop-in, Memo Dictation. Sound design lands here. Phase-shift hue lands here. | Peak interaction polish. The product feels *alive*. |
| **5 · Strategy → Execution + Operator Tier** | Strategy→Execution Dashboard, Drift gauges, Replan cards, OKR/Initiative cards, **Operator Tier** (Slack bot, Notion sidebar, Linear, simplified web), Email digest. | Two-tier completeness; operator polish parity. |
| **6 · Learning Loop** | Calibration Scorecard (editorial), Playbook surfacing UI, Causal-lite post-mortem reader, Anti-hallucination audit dashboard. | First "you got smarter" reveal moments. |
| **7 · Portfolio + Synergy + Briefing (WOW)** | **Portfolio Constellation (signature)**, Synergy Queue (Linear-style triage), **Synergy detected pulse moment**, Voice Briefing Player (full Loom-Spotify polish), Portfolio Thesis Editor, Cross-co playbook surfacing. | Maximum wow. The screenshot moments. |
| **8 · Harden + On-Prem** | Performance tuning of all motion (60fps audit), accessibility audit pass, reduced-motion verification, on-prem mode visual indicator (a discreet `local` chip), full documentation site. | Production grade. |

**Cross-cutting (every phase):** Each new surface must satisfy DP11 (no empty states without next action), DP12 (briefing-default), DP3 (citation by design), and pass keyboard + reduced-motion checks before merging.

---

## Appendix · Open UX Decisions

These should be resolved by the design lead during build, not pre-decided here:

- **UX-OD1** — Light mode launch parity, or follow-on after Phase 4?
- **UX-OD2** — Mobile native app vs. PWA-only at Phase 5 operator launch?
- **UX-OD3** — Custom illustrations for empty states (warmth) vs. pure typographic empty states (restraint)?
- **UX-OD4** — Constellation positioning algorithm: hand-tuned (Vignelli-style) vs. force-directed with snapping?
- **UX-OD5** — Persona avatar style: abstract geometric (current proposal) vs. abstract organic blobs vs. monogram letters?
- **UX-OD6** — Briefing voice: single house voice for the platform, or one per portco?
- **UX-OD7** — Density toggle: per-surface memory (sticky) vs. per-session (reset on nav)?

---

## Document History

- **v1 · 2026-05-20** — Initial UX/UI design plan. Codifies design DNA, 12 principles, 12 wow moments, IA model, 13 surface specs, design system, accessibility, onboarding, anti-patterns, signature, and phase mapping. Companion to `GUIDING_PRINCIPLES.md` v1 and `IMPLEMENTATION_PLAN.md` v2.

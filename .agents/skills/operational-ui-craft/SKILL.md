---
name: operational-ui-craft
description: >
  Anti-slop design skill for B2B IoT and operational intelligence product UIs.
  Covers executive dashboards, operational monitoring views, briefings/reports,
  configuration screens, and widget/component libraries. Applies structured
  brief inference, role-aware design reads, data density dials, and a strict
  pre-flight checklist against the most common LLM dashboard design failures.
  ALWAYS trigger when the user asks to build, design, prototype, or review ANY
  operational UI: dashboards, monitoring screens, KPI views, alert panels,
  IoT data interfaces, executive briefings, operational reports, sensor data
  views, configuration forms, or widget systems for B2B/industrial contexts.
  Pair with ecosat-designer for brand tokens when building Sidón/Duma UIs.
---

# Operational UI Craft — Anti-Slop for B2B IoT Dashboards

> Dashboards, monitoring views, executive briefings, operational reports, config screens, widget libraries.
> NOT landing pages. NOT marketing sites. NOT portfolios.
> Every rule is contextual. Read the operational brief first, then apply only what fits.

---

## 0. BRIEF INFERENCE (Read the Operational Moment)

Before any layout or component decision, identify **what operational moment this UI serves**.
LLM dashboard output is bad because it defaults to "put charts everywhere" instead of
reading the operator's actual cognitive need.

### 0.A — The Five Operational Moments

| Moment | User's Question | Design Priority |
|---|---|---|
| **Decision Support** | "What's the status of my operation right now?" | Clarity, synthesis, no noise |
| **Action Triage** | "What do I need to do next, and how urgent is it?" | Task hierarchy, CTA proximity |
| **Configuration** | "How do I set this up / change this threshold?" | Labeled forms, confirmation safety |
| **Reporting** | "What happened during this period?" | Narrative structure, exportable |
| **Exploration** | "Why is this metric behaving this way?" | Filtering power, raw data access |

### 0.B — Role Read (mandatory before any layout)

The role determines data density, action proximity, and aggregation level.
Wrong role = wrong screen, no matter how well designed.

| Role | Aggregation | Data Density | Primary Need |
|---|---|---|---|
| **Executive / C-Suite** | Network / multi-site | Very low (3–5 KPIs) | Status at a glance, exception-first |
| **Regional Manager** | Region / cluster of sites | Low-medium (8–15 metrics) | Comparative performance, trends |
| **Site Manager** | Single site + zones | Medium (15–30 metrics) | Operational status + drill-down |
| **Operator / Technician** | Zone / equipment | High (task list + sensor data) | What to do, what's broken |
| **Analyst** | Any scope | Very high (raw data + filters) | Filtering, export, pattern finding |

### 0.C — Output a two-line "Operational Read" before generating

State clearly:
**"Moment: [decision support / action triage / config / reporting / exploration]"**
**"Role: [executive / regional / site manager / operator / analyst] viewing [scope]"**

Example:
> *Moment: decision support. Role: regional manager viewing a cluster of 12 cold-chain facilities.*
> *Dial baseline: DATA_DENSITY 4, ACTION_PROXIMITY 2, TIME_ORIENTATION 6.*

### 0.D — If the brief is ambiguous, ask ONE question

Example: *"Is the primary user of this screen making decisions (viewing status) or taking actions (executing tasks)?"*

If context is sufficient, **do not ask**. Declare the operational read and proceed.

---

## 1. THE THREE OPERATIONAL DIALS

Set these after the operational read. Every layout and component decision is gated by these values.

- **`DATA_DENSITY: 4`** — 1 = executive digest (3 KPIs), 10 = analyst raw table (500 rows)
- **`ACTION_PROXIMITY: 3`** — 1 = read-only view, 10 = every data point is editable inline
- **`TIME_ORIENTATION: 5`** — 1 = historical reports only, 10 = live stream, every 5 seconds

**Baseline:** `4 / 3 / 5`. Override per role:

| Role | DATA_DENSITY | ACTION_PROXIMITY | TIME_ORIENTATION |
|---|---|---|---|
| Executive | 2 | 1 | 3 |
| Regional Manager | 4 | 2 | 5 |
| Site Manager | 6 | 4 | 7 |
| Operator / Technician | 8 | 8 | 9 |
| Analyst | 9 | 2 | 4 |

**Moment modifiers:**
- Config screens: ACTION_PROXIMITY always 9+, DATA_DENSITY 3 (forms need space)
- Reporting: TIME_ORIENTATION always 1–3 (historical), DATA_DENSITY up to 8
- Exploration: DATA_DENSITY always 8–10, ACTION_PROXIMITY 3 (filter, not edit)

---

## 2. SURFACE ROUTING

Five surfaces. Each has distinct layout philosophy. Route here after the operational read.

| Surface | Description | Reference |
|---|---|---|
| **Executive Dashboard** | High-level status, exception-first, N=1 screen | `references/surfaces.md → Section A` |
| **Operational View** | Dense, real-time, alert-first, N=many metrics | `references/surfaces.md → Section B` |
| **Briefing / Report** | Narrative structure, exportable, time-bounded | `references/surfaces.md → Section C` |
| **Config / Setup** | Forms, wizards, threshold editors | `references/surfaces.md → Section D` |
| **Widget / Component Library** | Reusable pieces, API-driven, composable | `references/surfaces.md → Section E` |

Read the relevant reference section before writing any component for that surface.

---

## 3. ANTI-SLOP PRINCIPLES (Top 10 — Full Catalog in `references/anti-tells.md`)

Read `references/anti-tells.md` before shipping any screen. The top 10 most violated:

1. **KPI without context** — A big number alone is meaningless. Always pair value + trend direction + delta vs. target or prior period.
2. **Chart spam** — 8 charts when 3 KPI cards would communicate better. Ask: "does this need a chart or just a number?"
3. **Alert saturation** — If everything is red, nothing is red. Maximum 3 severity levels. Fewer active critical alerts = better designed system.
4. **Stale state blindness** — Never show "live" data without a visible last-refreshed timestamp. Show a staleness indicator when data is > threshold old.
5. **Orphaned filters** — Filters with no visible active state, no "clear all," no count of results affected. Active filters must show as dismissible chips.
6. **Legend overload** — Charts with 7+ series that nobody can parse. Maximum 5 series; group the rest as "Other."
7. **No empty state** — Tables, lists, and alert panels must have a designed empty state. Blank is not a state.
8. **Status badge inflation** — 12 different badge colors with no legend. Pick a semantic system: green/yellow/red/grey, and nothing else.
9. **Modal nesting** — Modals inside modals. Configuration triggered from a detail modal triggered from a list modal. Flatten to drawer + inline.
10. **False precision** — "87.3% efficiency" when the sensor precision is ±2%. Show the right number of significant figures.

---

## 4. CORE COMPONENT PHILOSOPHY

### 4.A — The Context-Complete Metric Card

A metric in operational UI is never just a number. Every KPI card must contain:
- **Primary value** — the number, formatted for the precision level
- **Label** — what the number is (never just an icon)
- **Trend indicator** — up/down/stable + direction
- **Delta** — vs. prior period OR vs. target, labeled explicitly ("vs. last week" not just "↑5%")
- **Status signal** — one of: on-track / at-risk / critical — not a raw percentage

Anti-pattern: `87%` in a large font with nothing else. That is not a KPI card. That is a number.

### 4.B — Alert Hierarchy (3 levels max)

| Level | Meaning | Visual Treatment | User Action |
|---|---|---|---|
| **Critical** | Requires immediate action | Red, always visible | Must acknowledge |
| **Warning** | Requires attention soon | Amber, visible | Can snooze |
| **Info** | FYI, no action required | Neutral, collapsible | Auto-dismiss |

No 4th, 5th, or 6th severity level. If you need more levels, your alert taxonomy is wrong.
Never use "success" alerts in operational context — absence of critical/warning IS success.

### 4.C — Drill-Down Navigation

Operational UIs have natural hierarchies: Network → Region → Site → Zone → Equipment → Sensor.

Rules:
- Always show a breadcrumb that reflects the current scope
- Clicking into a scope never loses the ability to go back up
- Filters set at a parent scope carry down; filters set at child scope don't propagate up
- The current scope label must always be visible in the header

### 4.D — Time Controls (mandatory for any TIME_ORIENTATION > 4)

Every operational view with time-sensitive data needs:
- A visible time range selector (last 1h / 6h / 24h / 7d / custom)
- Current timezone displayed (not assumed)
- Last-refreshed timestamp + manual refresh trigger
- For live data: a live/paused toggle with elapsed-since-pause counter

---

## 5. LAYOUT RULES BY DENSITY

### LOW DENSITY (DATA_DENSITY ≤ 3) — Executive / Status
- Max 6 primary metrics visible without scroll
- Primary layout: 2–3 column KPI row + single chart + exception list
- Narrative copy is allowed — executives read
- No raw data tables
- Color only for status signal, not decoration

### MEDIUM DENSITY (DATA_DENSITY 4–6) — Operational Overview
- Max 12–20 metrics per screen section
- Primary layout: KPI strip + metric grid + time series + alert panel
- Sidebar or top-bar for navigation context
- Tables allowed with max 8–10 columns
- Sparklines as secondary data visualization

### HIGH DENSITY (DATA_DENSITY 7–10) — Operator / Analyst
- Tables are primary layout, not supplemental
- Sticky column headers, sortable, filterable
- Compact metric display: smaller type, tighter padding
- Color coding IS information at this density, not decoration
- Monospace for all numeric data

---

## 6. FORBIDDEN DEFAULTS (Dashboard LLM Tells)

The LLM default for "design a dashboard" produces predictable slop. Avoid:

- **Dark mode with neon gauges** — the "cyberpunk monitoring screen" aesthetic for a B2B ops tool
- **Donut chart as the hero metric** — a filled percentage in a ring communicates nothing faster than a number
- **Card grid of 6 equal identical metric cards** — no hierarchy, no context, no status
- **Every section has a chart** — charts exist to show shape/trend, not to prove data exists
- **Blue as the only color** — operational UIs need semantic color: red = bad, amber = warning, green = good, grey = unknown. Blue is not a status.
- **"Last updated: just now"** — meaningless. Show an actual timestamp.
- **Infinite scroll for alert lists** — alerts need pages, counts, and "mark all read"
- **No skeleton / no loading state** — data takes time; design for the latency

---

## 7. DARK MODE RULE FOR OPERATIONAL UI

Operational UIs follow an explicit rule:

- **Monitoring / control room screens** (TIME_ORIENTATION ≥ 8): dark mode acceptable — reduces eye strain for continuous display, 24/7 operation
- **All other operational surfaces**: light mode default — better for intermittent use, printable reports, ambient lighting
- **Never auto-switch** based on `prefers-color-scheme` in operational context; user preference or admin setting should control it explicitly

---

## 8. PRE-FLIGHT

Full checklist in `references/preflight.md`. Run it before delivering any screen.

Quick mandatory checks:
- [ ] Operational Read declared (moment + role)?
- [ ] Dials set and reasoned?
- [ ] Surface routed and reference section read?
- [ ] Every KPI card has value + trend + delta + status?
- [ ] Zero donut charts as primary metric displays?
- [ ] Alert hierarchy max 3 levels?
- [ ] Last-refreshed timestamp visible on all live data?
- [ ] Empty states designed for all lists and tables?
- [ ] Active filter state visible and clearable?
- [ ] Zero dark-neon dashboard aesthetic unless control-room context?

---

## REFERENCES

Read these when needed — do not load all upfront:

- `references/surfaces.md` — Surface-specific patterns (A: Executive, B: Operational, C: Briefing, D: Config, E: Widget Library)
- `references/anti-tells.md` — Full anti-slop catalog, 30+ operational UI tells
- `references/preflight.md` — Complete pre-flight checklist (55+ items)

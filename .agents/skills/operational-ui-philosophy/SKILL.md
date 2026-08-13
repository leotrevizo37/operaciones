---
name: operational-ui-philosophy
description: >
  Santiago's personal design philosophy for operational intelligence interfaces —
  dashboards, KPI views, and decision-support screens for industrial/retail IoT
  contexts (Sidón, Duma AI). Encodes concrete, opinionated principles for what
  makes an operational screen good vs. broken. ALWAYS trigger when designing,
  reviewing, or critiquing any UI screen for Sidón, Duma, or operational dashboards
  — especially executive views, KPI cards, metric summaries, alert systems, ICOS
  views, or any screen where a user must make an operational decision. Also trigger
  when the user says "¿cómo debería verse esta pantalla?", "revisa este diseño",
  "ayúdame a diseñar X vista operacional", or "¿está bien este dashboard?".
---

# Operational UI Philosophy

Design for the operator, not the analyst. A dashboard that requires interpretation
has already failed.

---

## Core Philosophy

Operational interfaces exist to **collapse the distance between data and decision**.
The user arrives with a question — "¿Está todo bien? ¿Dónde debo enfocarme?" — and
leaves with a clear answer and a clear next step.

In the Sidón/Duma context, users range from a store manager checking in for 30
seconds to a Regional Director scanning 40 locations before a meeting. Neither has
time to think. The interface thinks for them.

Every design decision is evaluated against one test: **does this shorten the path
from data to decision, or lengthen it?**

---

## The Nine Non-Negotiables

### 1. Bottom Line Up Front (BLUF)
Every metric, KPI, or dashboard view leads with the **verdict**, not the data.
The structure is always: **Status → Number → Context → Next step**.

The drill-down path is dictated by what the data says, not by the menu structure.
If everything is fine, the user must be able to confirm that in under 5 seconds.
If something is wrong, the screen tells them exactly where to go next.

❌ Wrong: a chart of temperature readings across 30 days  
✅ Right: `⚠️ 3 equipos en alerta crítica esta semana · Tiempo promedio de respuesta: 4.2h · [Ver sucursales críticas]`

The number is evidence. The verdict is the headline. Never invert them.

### 2. "Leer, no pensar"
Reading is the mode; interpretation is not. Conclusions are headlines. Supporting
data is body copy. Raw numbers without context never appear alone on an executive view.

Every metric on a directivo screen must answer at minimum:
- What is the number?
- Is it good or bad? (vs. target, vs. last period)
- What changed since last time?

If any of the three is missing, the metric is incomplete.

### 3. Role-before-data
Design starts with the user, not the data model. A field manager (Mariana) and an
Operations Director (Roberto) looking at the same alert are in completely different
contexts and need completely different interfaces.

Before any design decision: **"Who sees this, and what action can they take?"**
If the user cannot act on the information shown, it should not be on their screen.

### 4. Light mode, always
Operational environments are bright — retail floors, warehouses, field sites.
Dark mode is never appropriate for Sidón/Duma interfaces. Backgrounds are
white-dominant. Sidón green is an accent color — reserved for status signals,
CTAs, and critical highlights only. Never as a background.

### 5. No right-side drawers
Detail expansion lives in **centered modals** or **inline accordions**. Never in
right-side drawers. Drawers fragment the spatial relationship between trigger and
detail, and collapse poorly across screen sizes and operational contexts.

### 6. ICOS is the executive spine
For any directivo-level view, ICOS (5 pillars: Higiene, Mantenimiento, Temperatura,
Operaciones, Cumplimiento) is the organizing principle. There is no generic
"dashboard" — there is an ICOS view. You don't design KPI cards and then arrange
them. You design around the 5 pillars and surface KPIs within them.

Single exception: field mode ("Estoy en una sucursal"), where the view collapses to
a store-level briefing that answers "¿cómo está esta tienda ahora mismo?"

### 7. AI output is content, not a widget
Duma's AI analysis appears as a **structured brief** — a document, not a chat window
embedded in the operational UI. The brief has: situación → hallazgos clave →
acciones recomendadas → señal de confianza. It renders as content; it does not
stream as conversation. It can be reviewed, approved, and versioned.

A chat bubble inside an operational dashboard is always wrong.

### 8. N-level transparency
The user always knows what level of autonomy is acting:
- **N1 — Alerta:** "Ocurrió algo, necesitas saberlo"
- **N2 — Recomendación:** "Esto es lo que sugerimos hacer"
- **N3 — Acción pendiente:** "Estamos a punto de hacer X, ¿confirmas?"
- **N4 — Corrección en vivo:** "Actuamos, aquí está lo que hicimos"

N-level is never hidden. Operators must understand the origin of every action or
recommendation surfaced in the interface. Hiding the autonomy level erodes trust
faster than any error the AI could make.

### 9. Type-aware equipment views
Equipment and asset detail pages are typed to their category. A cuarto frío view
is not the same as an HVAC view — different metrics, different thresholds, different
action paths. A generic "sensor card" is a placeholder, never a finished design.

Approved types: cuarto frío, equipo HVAC, báscula, equipo de seguridad.
Any "generic" type in a final design is a blocking issue.

---

## Decision Framework

When facing a design decision, apply in this order:

1. **BLUF check** — Is the verdict visible in under 5 seconds?
2. **Role check** — Does this design serve the right user's specific decision?
3. **Action check** — What action does this screen enable? If none, why is it here?
4. **ICOS check** — Does this content fit within a pillar, or is it floating?
5. **Clutter check** — If you removed this element, would the screen improve?

If you reach step 5 without a clear answer, the element probably shouldn't exist.

---

## Review Mode

When given a screen, mockup, component, or description to review, produce the
following two parts in order.

### Part 1 — Findings Table (required)

A single markdown table. One row per issue. Never bullet lists.

| Problema | Principio violado | Corrección |
|---|---|---|
| KPI muestra número crudo sin tendencia ni veredicto | BLUF: no hay veredicto visible | Agregar indicador de estado + contexto (vs. meta, vs. semana anterior) |
| Panel de detalle en drawer lateral | Sin right-side drawers | Mover a modal centrado |
| Vista igual para encargado y director regional | Role-before-data ignorado | Separar en dos vistas con decisiones distintas |

### Part 2 — Verdict (required)

Group commentary by impact, highest first. Omit empty tiers.

1. **Bloqueantes** — BLUF ausente, N-level oculto, drawers laterales, modo oscuro
2. **Role clarity** — audiencia incorrecta o mezclada en una sola vista
3. **ICOS alignment** — contenido que flota sin pilar definido
4. **AI content** — análisis de IA como chat widget en lugar de brief estructurado
5. **Type awareness** — vistas genéricas donde debe haber tipo específico

Close with explicit decision:
- **Block** — any bloqueante present
- **Approve** — non-negotiables respected (may include suggestions)

---

## What This Skill Is NOT

- **Not a brand guide** — use `ecosat-designer` for design tokens, colors, and typography
- **Not Sidón product context** — use `sidon-context` for module specs and ICOS framework detail
- **Not motion/animation design** — use `emil-design-eng` for interaction and animation decisions

When brand execution is needed alongside this philosophy, combine with `ecosat-designer`.

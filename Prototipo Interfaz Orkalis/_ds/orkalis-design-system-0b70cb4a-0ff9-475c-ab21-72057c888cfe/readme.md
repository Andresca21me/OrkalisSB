# Orkalis Design System

> The brand and interface system for **Orkalis Software Solutions** — B2B custom
> software development and digital transformation for SMBs in Latin America.

Orkalis builds web platforms, SaaS products, client dashboards, and the corporate
website. This system exists so every surface — marketing site, product app,
client dashboard, sales deck — looks like one confident, technically-precise
company. Think **Linear + Ramp**, adapted for the Colombian SMB context:
Spanish-first, warmer in tone, simpler onboarding than US enterprise.

The north star: **data is the hero, design recedes.** Confident, not loud.
Sophisticated, not cold.

---

## Sources

This system was authored from a written brand specification (color, type,
geometry, voice, and SaaS-pattern guidelines) — there was **no external codebase
or Figma file** to import. If/when a production codebase or Figma library exists,
link it here and reconcile any drift:

- Codebase: _(none provided — add repo URL here)_
- Figma: _(none provided — add file link here)_
- Brand spec: provided inline by the user (June 2026)

---

## CONTENT FUNDAMENTALS

How Orkalis writes. The brand archetype is **The Ruler** (authoritative,
organized, results-oriented) with a **Sage** secondary (smart, educational,
data-backed, advisor-like).

**Voice**
- **Direct and declarative.** Short sentences. State the outcome, then the proof.
- **Data-backed.** Claims are quantified ("reduce el cierre contable de 5 días a 1"),
  never vague hype.
- **Authoritative but warm.** This is a Colombian SMB audience — confident advisor,
  not a Silicon Valley pitch.
- **Bilingual reality.** Product UI and marketing copy are **Spanish-first
  (Colombia)**. Technical docs, API references, and code identifiers are English.

**Person & address**
- Address the customer as **"tu / tu empresa"** (informal-professional "you"),
  not the corporate "usted" wall and not first-person "we revolutionize…".
- Frame around the customer's control and outcome: _"Tu empresa en control."_

**Casing**
- Headlines and body: **sentence case** in Spanish (only first word + proper
  nouns capitalized). Reserve ALL CAPS for the wordmark and short eyebrows/labels.
- Buttons: sentence case, imperative, outcome-specific.

**CTA style — specific and outcome-focused**
- ✅ "Organiza tu operación hoy" · "Reemplaza el Excel definitivamente" ·
  "Automatiza sin complicaciones" · "Agenda una demostración"
- ❌ "Get Started" · "Learn More" · "Sign Up" · "Try it free"

**Emoji:** none. Not in product, not in marketing. Use Lucide icons instead.

**Banned words/phrases** (corporate cliché / hype): revolutionary,
game-changing, disruptive, world-class, seamless, leverage, next-level.

**Anti-traits:** NOT informal, NOT hype-driven, NOT startup-bro, NOT futurist
vaporware.

**Examples of the voice**
- Eyebrow: `PLATAFORMA DE OPERACIONES`
- Hero H1: "Tu empresa en control, sin hojas de cálculo."
- Sub: "Centraliza inventario, facturación y equipo en una sola plataforma.
  Implementación en semanas, no en meses."
- KPI label: "Ingresos del mes" · trend: "↑ 12,4% vs. mes anterior"
- Empty state: "Aún no tienes facturas. Crea la primera para empezar a medir."

---

## VISUAL FOUNDATIONS

The visual language is **cool-toned, geometric, and dense** — restrained color
with high information density.

**Color**
- **Navy `#0F1923`** is the authority surface: sidebars, app nav, footers, deck
  section breaks. It signals technical precision (vs. generic pure black).
- **Electric blue `#1A73E8`** is the single brand/action color: CTAs, links,
  active nav, focus rings. Hover lightens (`#4D94F0`), press darkens (`#1558C0`).
- **Teal `#00D4AA`** is a 10% accent only — positive deltas, KPI growth,
  data-positive highlights. **Never** in the logomark, never as a large fill.
- Semantic: success `#10B981`, warning `#F59E0B`, error `#EF4444`, info `#3B82F6`.
- Neutrals are a **cool slate** ramp (gray-50…950), never warm grays.
- **Avoid:** warm oranges (startup-y), purple (generic SaaS cliché), green
  primaries (fintech), and especially the `#667eea→#764ba2` gradient cliché.

**Type**
- **Plus Jakarta Sans** 700/800 for display — headlines, section titles,
  dashboard headers, and KPI numbers. Tracking `-0.02em` (`-0.04em` for the
  wordmark). Geometric grotesque with personality; technical + ambitious.
- **DM Sans** 400/500/600 for everything UI — body, labels, nav, table data,
  forms. Clean and legible at small sizes.
- **JetBrains Mono** 400/500 for data, code, API refs, IDs, DB keys, and
  tabular numbers in tables/KPIs (`font-feature-settings: "tnum"`).
- **Never** Inter, Roboto, or Open Sans.

**Spacing & layout**
- Strict **8pt grid** (`--space-*`). Desktop is **12-column, 24px gutter,
  1280px max content, 80px side padding**. Dashboard is a fixed **240px navy
  sidebar + fluid 12-col content**. Density is Retool/Linear — compact rows,
  14–15px base text.

**Backgrounds**
- No photographic hero imagery, no isometric 3D, no stock blobs. Surfaces are
  flat near-white (`#F8FAFC`) or flat dark (`#0A0F14`). Optional decoration:
  subtle **geometric line/grid motifs** or a faint dot grid — abstract, never
  illustrative. No gradients on nav or logo.

**Corner radii (no uniform rounding)**
- 4px inputs/badges · 6px cards/dropdowns/tooltips · 8px primary cards/modals ·
  12px large content cards · 16px hero cards only · pill for tags/chips.

**Cards**
- Light: `#FFFFFF` + **1px `#E2E8F0` border** + `shadow-sm` at rest, `shadow-md`
  on hover. Dark: `#111827` + 1px `#1F2937` border. Cards lead with a border,
  shadows stay subtle and **neutral** — no colored or Material shadows.

**Shadows / elevation**
- Layered neutral shadows only: `xs` inputs → `sm` cards → `md` hover → `lg`
  modals/dropdowns → `xl` toasts/floating. Never hard drop-shadows, never tinted.

**Borders**
- 1px hairlines (`--gray-200/300`) do most of the structural work. Tables use
  **horizontal borders only** (no vertical rules), with gray-50/white zebra.

**Motion**
- Restrained and quick. `120–260ms`, ease-out (`cubic-bezier(0.16,1,0.3,1)`).
  Fades and small translates; **no bounce**, no springy overshoot, no infinite
  decorative loops. Loading uses **skeleton shimmer** (gray-100→gray-200), never
  full-page spinners.

**Hover / press states**
- Buttons: primary hover → lighter blue (`--brand-hover`); press → darker
  (`--brand-pressed`). Ghost/secondary hover → `--surface-sunken` fill.
- Cards: hover lifts shadow `sm → md`, border may deepen one step. No scale on
  cards. Pressable controls may translate 1px / dim slightly — no shrink-scale.

**Transparency & blur**
- Sparingly. Sticky headers may use a translucent surface + light backdrop blur.
  Tinted fills (`--brand-tint`, `--*-tint`) back badges and selected rows.

**Focus**
- Always visible: **2px solid `#1A73E8`, 2px offset.** Never removed.

---

## ICONOGRAPHY

- **System: Lucide Icons**, used exclusively. 2px stroke, clean geometric,
  `currentColor`. Standardize on this one set — do not mix icon families.
- **Delivery:** Lucide is loaded from CDN (`lucide@latest`) in cards and UI kits;
  in production, install the `lucide` / `lucide-react` package. We do **not**
  vendor a custom icon font or sprite — there is no proprietary icon set.
- **Sizing:** 16px inline/table, 20px nav & buttons, 24px headers. Stroke stays
  2px; scale the box, not the stroke.
- **Color:** inherit text color; use `--brand` for active/interactive, semantic
  colors for status. Teal only for positive-data glyphs.
- **No emoji. No unicode glyphs as icons** (the only exception is the ↑ / ↓
  trend arrows in KPI deltas, which are intentional typographic indicators).
- **Logo:** the Orkalis mark is a geometric "O" — a rounded outer square
  (system/container) with an offset inner circle (orbit/loop), suggesting
  organized, cyclical automation. Monochrome only: `#0F1923` on light,
  `#FFFFFF` on dark. No gradients, no teal in the mark, no strokes below 2px.
  See `assets/logo/`.

**Illustration:** if ever needed, abstract geometric shapes only — never
isometric 3D, never character illustrations, never stock hero art.

---

## INDEX — what's in this system

**Root**
- `styles.css` — the single entry point consumers link. `@import`s only.
- `readme.md` — this guide.
- `SKILL.md` — portable Agent-Skill manifest.

**`tokens/`** — CSS custom properties (reachable from `styles.css`)
- `colors.css` · `typography.css` · `spacing.css` · `radius-elevation.css`
- `fonts.css` (Google Fonts CDN) · `base.css` (element defaults)

**`assets/logo/`** — Orkalis mark (currentColor, navy, white variants)

**`guidelines/`** — foundation specimen cards (Design System tab): colors, type,
spacing, radius, elevation, logo/brand.

**`components/core/`** — reusable React primitives:
Button · IconButton · Input · Select · Checkbox · Switch · Badge · Tag ·
Avatar · Card · KpiCard · Tabs · Alert · Tooltip · Dialog. Each ships
`<Name>.jsx` + `.d.ts` + `.prompt.md`, with one card HTML per group.

**`ui_kits/`** — full-screen product recreations:
- `dashboard/` — the Orkalis app (sidebar layout, KPI row, charts, tables).
- `marketing/` — the corporate website (top nav, hero, feature grid, pricing).

> Tokens, components, and cards are discovered by the compiler from file content
> and sibling relationships — not folder names. Use `window.OrkalisDesignSystem_0b70cb`
> to reach components in card/kit HTML.

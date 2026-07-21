# Asmos Design System (v1 — extracted from reference UI)

Source: `AD1B9107-7521-476A-ADF6-C44F1D824B4D.png` (Experiments / Knockout Bracket page). This is the visual baseline for all Phase 1 pages — same components, same tokens, just without the bandit-specific views until Phase 4.

## Color Tokens

| Token | Approx value | Usage |
|---|---|---|
| `--color-primary` | `#6366F1` (indigo-500) | Logo, active nav item, primary buttons, links, winning-variant highlight |
| `--color-primary-dark` | `#4F46E5` (indigo-600) | Button hover/active states |
| `--color-primary-light` | `#EEF2FF` (indigo-50) | Active nav background, selected-row background |
| `--color-success` | `#22C55E` (green-500) | "Live"/"Running" badges, positive trend arrows |
| `--color-success-bg` | `#DCFCE7` (green-50/100) | Badge background |
| `--color-neutral-badge` | `#F3F4F6` (gray-100) | "Eliminated" / inactive badges |
| `--color-text-primary` | `#111827` (gray-900) | Headings, key numbers |
| `--color-text-secondary` | `#6B7280` (gray-500) | Labels, timestamps, helper text |
| `--color-border` | `#E5E7EB` (gray-200) | Card borders, table dividers |
| `--color-surface` | `#FFFFFF` | Card/page background |
| `--color-surface-sunken` | `#F9FAFB` (gray-50) | Page background behind cards, sidebar |
| Variant accent colors | purple, pink, orange, green, blue, cyan (rotating) | Per-variant swatches/avatars in tables and charts — needs a fixed 6–8 color categorical palette (see `dataviz` skill for a validated set) |

Single-accent system: indigo is the *only* brand color carrying meaning (primary actions, "winning" state). Everything else is neutral gray + semantic green, with a rotating categorical palette reserved strictly for distinguishing variants in charts/tables.

## Typography

- Font: Inter (or similar geometric sans) throughout, no serif/display font
- Scale: page title ~20–24px semibold → card stat numbers ~28–32px bold → body/table text ~13–14px regular → helper/meta text ~12px regular, gray-500
- Numbers get visual priority over labels (big bold conversion rate, small gray "Conversion Rate" caption underneath)

## Layout

- Fixed left sidebar (~220px), icon + label nav items, active item gets indigo text + light indigo background pill
- Top bar per page: breadcrumb ("← Back to X") + page title + inline status badge, right-aligned page-level actions (date range picker, primary/secondary buttons)
- Content area: horizontal tab strip for sub-views (Overview / Knockout Bracket / Variants / Performance / Segments / AI Learnings / Settings) directly under the header
- Main content is a responsive grid of cards: wide primary panel (bracket/chart) + narrow right rail (summary stats, allocation donut, AI callout)
- Data tables live below the visual/chart section, not above

## Components (inventory to build)

- `Sidebar` — icon nav, active state, collapsible sections
- `PageHeader` — breadcrumb + title + status badge + action slot
- `Tabs` — underline style, active = indigo text + indigo underline
- `Badge` — status pill, variants: live/success (green), eliminated/neutral (gray), running (green), draft (gray)
- `StatCard` — big number + small label, used standalone and inside summary panels
- `DonutChart` — traffic allocation style, with legend dots + percentages
- `Sparkline` — inline mini trend line per table row
- `DataTable` — sortable columns, search input, filter button, export icon, pagination footer, per-row thumbnail + title + subtitle
- `ConfidenceBar` — horizontal progress bar for "confidence to be best"
- `CalloutCard` — left icon + short message, used for "AI is optimizing" and "Need help" panels in sidebar footer
- `Avatar` + account switcher in top-right (name, org, chevron)

## Notes for Phase 1 reuse

Phase 1 pages (Dashboard Home, Campaigns List, Popup Builder, basic Analytics) should reuse: `Sidebar`, `PageHeader`, `Badge`, `StatCard`, `DataTable`. Skip `DonutChart`/`ConfidenceBar`/bandit-specific `CalloutCard` copy until Phase 3–4 when A/B testing and bandit logic actually exist — but keep the components generic enough now that dropping them into the Experiments page later is a data-wiring problem, not a redesign.

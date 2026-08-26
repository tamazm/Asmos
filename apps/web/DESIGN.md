# Asmos - Design System

## Color Tokens

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#165DFF` | Primary buttons, active nav, links, focus rings |
| `--color-primary-dark` | `#124FD9` | Button hover/active |
| `--color-primary-light` | `#ECF2FF` | Active nav bg, selected row bg, tinted surface |
| `--color-success` | `#22C55E` | Live/running badges, positive trends |
| `--color-success-bg` | `#DCFCE7` | Badge backgrounds |
| `--color-neutral-badge` | `#F3F4F6` | Inactive/draft badge bg |
| `--color-text-primary` | `#0D0D10` | Headings, key numbers |
| `--color-text-secondary` | `#6B7280` | Labels, helper text, timestamps |
| `--color-border` | `#E5E7EB` | Card borders, dividers |
| `--color-surface` | `#FFFFFF` | Card/page bg |
| `--color-surface-sunken` | `#F3F4F6` | Page bg behind cards, sidebar |

## Typography

- **Font**: Geist (replaces Inter) via `next/font/google`
- **CSS var**: `--font-geist`
- **Smoothing**: `-webkit-font-smoothing: antialiased` on root
- **Display/H1**: `text-4xl md:text-5xl font-bold tracking-tight leading-[1.1]`
- **H2/Card titles**: `text-2xl font-semibold tracking-tight`
- **Body**: `text-sm text-[color:var(--color-text-secondary)] leading-relaxed`
- **Labels**: `text-xs font-medium uppercase tracking-wide`
- **Headings**: `text-wrap: balance`
- **Body text**: `text-wrap: pretty`
- **Numbers**: `tabular-nums` for dynamic/data numbers

## Spacing & Layout

- **Page max-width**: `max-w-7xl mx-auto`
- **Content card max-width**: `max-w-lg` for onboarding, `max-w-2xl` for wider forms
- **Section padding**: `px-6 py-12` (mobile: `px-4`)
- **Card padding**: `p-8` (compact: `p-6`)
- **Sidebar width**: `w-56` (224px)
- **Top bar height**: `64px` (`h-16`)

## Border Radius Scale

- **Cards/modals**: `rounded-2xl` (16px)
- **Buttons**: `rounded-lg` (8px)
- **Inputs**: `rounded-lg` (8px)
- **Badges**: `rounded-full`
- **Inner elements in cards**: `rounded-md` (6px) - concentric radius rule
- Rule: outer radius = inner radius + padding

## Elevation / Shadows

- **Card default**: `shadow-sm` (subtle), `border border-[color:var(--color-border)]`
- **Card hover**: `shadow-md` with transition
- **Dropdown/popover**: `shadow-lg ring-1 ring-black/5`
- No pure black shadows - always tinted or transparent

## Components

### Buttons
- Primary: `bg-[color:var(--color-primary)] text-white hover:bg-[color:var(--color-primary-dark)] active:scale-[0.98]`
- Secondary: `bg-[color:var(--color-surface)] border border-[color:var(--color-border)] text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)]`
- Height: `h-10` (40px) minimum for accessibility
- Transition: `transition-colors duration-150` (not `transition-all`)

### Inputs
- Base: `rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm`
- Focus: `focus:outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20`
- Label above, no placeholder-as-label

### Badges
- Live/Success: `bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]`
- Neutral/Draft: `bg-[color:var(--color-neutral-badge)] text-[color:var(--color-text-secondary)]`
- Base classes: `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium`

### Cards
- `rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-sm`

## Motion

- **Page enter**: fade + slide up, `opacity: 0 → 1`, `translateY: 8px → 0`, `300ms ease-out`
- **Hover**: `150ms ease-out` on color/shadow transitions
- **Button press**: `active:scale-[0.98]` via `transition-transform duration-75`
- No GSAP (not installed)
- CSS only: `@keyframes fadeSlideUp` applied via class on page mount
- Honor `prefers-reduced-motion`: gate all animations behind `@media (prefers-reduced-motion: no-preference)`

## Logo Usage

| Context | Asset |
|---|---|
| Light bg (white/mist) - nav, sidebar | `asmos-logo-primary-lightbg.webp` |
| Centered auth/onboarding | `asmos-logo-stacked-lightbg.webp` |
| Icon-only / small sizes | `asmos-logo-icononly-lightbg.webp` |

## Data Viz Categorical Palette

For variant swatches in tables/charts (rotate, do not mix):
- Blue `#3B82F6`, Purple `#8B5CF6`, Pink `#EC4899`, Orange `#F97316`, Green `#10B981`, Cyan `#06B6D4`

## Onboarding Progress Steps

| Step | Path | Label |
|---|---|---|
| 1 | `/onboarding` | Welcome |
| 2 | `/onboarding/business-profile` | Business Profile |
| 3 | `/onboarding/consent` | Compliance |
| 4 | `/onboarding/connect-store` | Connect Store |

## Pre-Auth Flow Steps

| Step | Path |
|---|---|
| 1 | `/` (homepage, URL input) |
| 2 | `/analyze` (scanning) |
| 3 | `/analyze/results` (confirm) |
| 4 | `/sign-up` or `/sign-in` (auth) |
| 5 | `/onboarding/business-profile` |
| 6 | `/onboarding/connect-store` |
| 7 | `/dashboard` |

## Anti-Patterns (Design)

- No gradient text
- No side-stripe accent borders on cards
- No nested cards
- No `transition: all`
- No `z-50` spam - use z-index scale: `10` sidebar/nav, `20` dropdowns, `30` modals, `40` toasts
- No `h-screen` for full-height layouts - use `min-h-[100dvh]`
- No `width: calc(33% - 1rem)` flex math - use CSS Grid

---

## New Patterns (Added 2026-07)

### Easing Tokens

Custom cubic-bezier variables defined in `:root` (not Tailwind tokens, used via `style` or inline `cubic-bezier()`):

| Token | Value | Usage |
|---|---|---|
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Page entry, reveals |
| `--ease-out-quart` | `cubic-bezier(0.25, 1, 0.5, 1)` | Hover state transitions |
| `--ease-fluid` | `cubic-bezier(0.32, 0.72, 0, 1)` | Button/card interactions |

All `transition-colors duration-150` hovers upgraded to `transition-[background-color,color,transform] duration-200`.
Page-enter animations upgraded from `300ms ease-out` to `480ms var(--ease-out-expo)`.

### Animation Stagger Delays

Extended stagger variants: `animate-page-enter-delay-4` (280ms). All delays now use `--ease-out-expo`.

### Scroll-Reveal Classes

Declared in `globals.css`. Elements start invisible via CSS, then get `.is-visible` applied by JS `IntersectionObserver`:

- `.reveal` - single element fade + slide up (600ms)
- `.reveal-stagger` - wrapper class; children stagger with 80ms intervals (1–6 children)

Apply `IntersectionObserver` in a client component with `threshold: 0.12`.

### Double-Bezel (Doppelrand) Component Pattern

A nested enclosure treatment that gives cards/containers physical depth without generic drop shadows.

```tsx
{/* Double-Bezel outer shell */}
<div className="rounded-[1.375rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5 shadow-sm">
  {/* Inner core */}
  <div
    className="rounded-[1rem] bg-[color:var(--color-surface)] p-6"
    style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.95)" }}
  >
    {/* content */}
  </div>
</div>
```

**Radius concentric rule:** outer `rounded-[1.375rem]` with `p-1.5` padding → inner `rounded-[1rem]` (outer - padding gap).

Applied to: `StatCard`, `DataTable`, `CalloutCard`, `HomepageForm`, wizard container (`campaigns/new`), step icons, icon wells in empty states and onboarding.

### Double-Bezel Icon Well

For standalone icons (empty states, onboarding, type selectors):

```tsx
<div className="rounded-[1.125rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5">
  <div
    className="flex h-12 w-12 items-center justify-center rounded-[0.75rem] bg-[color:var(--color-primary-light)]"
    style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)" }}
  >
    {/* icon */}
  </div>
</div>
```

### ButtonArrow - Button-in-Button Pattern

A `ButtonArrow` component exports alongside `Button`. Wraps an arrow icon in its own circular pill for internal kinetic tension on hover.

```tsx
import { ButtonArrow } from "@/components/ui/Button";
<ButtonArrow href="/next-step">Get started</ButtonArrow>
```

- Pill shape: `rounded-full h-11 pl-5 pr-1.5`
- Arrow icon wraps: `h-8 w-8 rounded-full bg-white/20`
- Hover: arrow translates `+0.5px / -1px` and scales `1.05`

Use for primary CTAs with directional intent (onboarding, landing hero, confirmation flows).

### Eyebrow Tags

Pill-shaped labels above section headings:

```tsx
<span className="inline-block rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-secondary)]">
  Section label
</span>
```

Used on landing page sections: "How it works", "Pricing".

### Transition Consolidation

All button/interactive elements use `transition-[background-color,color,transform,box-shadow] duration-200` instead of `transition-colors duration-150`. This enables smooth press-scale feedback without animating layout properties.

Active scale: `active:scale-[0.97]` (was `0.98`; slightly more tactile).

### Featured Pricing Card

The Growth/featured pricing plan uses the Double-Bezel pattern with a primary-tinted outer shell instead of a plain border:

```tsx
<div className="rounded-[1.375rem] border border-[color:var(--color-primary)]/30 bg-[color:var(--color-primary-light)] p-1.5 shadow-md">
  <div className="rounded-[1rem] bg-[color:var(--color-surface)] p-7" style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.95)" }}>
    {/* plan content */}
  </div>
</div>
```

### StepBar Step Indicator

Wizard step bubbles use Double-Bezel instead of plain circles:
- Outer: `rounded-[0.625rem] p-0.5 bg-[color:var(--color-primary)]/15` (active/done)
- Inner: `rounded-[0.5rem] bg-[color:var(--color-primary)] text-white`

Conveys done/active/pending state while maintaining the depth hierarchy.

### PageHeader

Removed the bottom border. Title is `font-bold` (was `font-semibold`). Back chevron now uses an SVG arrow instead of a raw `←` character.

---

## Dashboard Home Cards (Added 2026-08)

The dashboard home grid uses a **flat card**, not the Double-Bezel shell that
`StatCard` and `DataTable` use:

```tsx
<section className="flex flex-col rounded-[14px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-[0_1px_2px_rgba(13,13,16,0.04)]">
  <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">…</header>
  <div className="flex flex-1 flex-col px-5 pb-5">…</div>
</section>
```

Reason: eight cards sit adjacent in a dense grid. The Double-Bezel reads as
depth on one or two isolated elements; repeated eight times across two rows it
turns into visual noise and steals 3px of inner width per side. Double-Bezel
stays the treatment for standalone stat tiles and tables elsewhere in the app.

Shared pieces live in `src/components/dashboard/primitives.tsx`:

| Piece | Rule |
|---|---|
| `DashboardCard` | Card shell. Header = 16px stroke icon + 15px semibold title + optional action slot (`SeeAllLink` or an inline button) |
| `TrendPill` | Filled triangle + one decimal + optional suffix. **Renders nothing when the prior window is empty** - "no basis for comparison" must not look like "flat" |
| `CardEmpty` | Plain centred 12px text. Empty states are quiet, never a styled upsell panel |
| `RowIcon` | 28px rounded tile for list rows |
| `formatCompact` | Exact below 100K, `295K` to 1M, `1.2M` above |

Card icons live in `src/components/dashboard/icons.tsx` - one 16px stroke
family, so every card header reads as the same set.

### Gauge (Pop-up Performance)

270-degree arc, open at the bottom, drawn as two `<circle>` elements inside
`<g transform="rotate(135 …)">` with `stroke-dasharray`. The scale is a plain
0-100% conversion rate; it is never rebased to the user's target, which would
make an unchanged rate render differently week to week. The value and caption
centre inside the ring, and the trend line is pulled up into the ring's open
bottom, where it may run wider than the ring's inner diameter. At 0% the value
arc is not rendered at all, because a round line cap on a zero-length dash
draws a dot that reads as "a little".

### Honest-zero rule

Every dashboard number is counted from the database. Where a comparison is
impossible - no prior window, no target set, a campaign with one variant -
`src/lib/dashboardMetrics.ts` returns `null` and the card renders its empty
state. No placeholder figures, no sample data, per PRODUCT.md.

### Top-level chrome

- Top bar is `h-20`: account avatar + name + context line on the left,
  notification bell + primary "Create Pop-up" on the right. The sidebar's logo
  row matches at `h-20` so the two align across the seam.
- The context line reads "Welcome back to Asmos" on `/dashboard` and the
  section name elsewhere (`TopBarGreeting`).
- Sidebar footer is the account row: Clerk `UserButton` (own click target, so
  sign-out survives) + name + email + chevron to `/settings`. The check beside
  the name means one concrete thing - at least one website has
  `installVerified` - and is hidden otherwise.
- Page titles are `sr-only` on the dashboard; the top bar carries identity.

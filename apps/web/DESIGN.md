# Asmos — Design System

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
- **Inner elements in cards**: `rounded-md` (6px) — concentric radius rule
- Rule: outer radius = inner radius + padding

## Elevation / Shadows

- **Card default**: `shadow-sm` (subtle), `border border-[color:var(--color-border)]`
- **Card hover**: `shadow-md` with transition
- **Dropdown/popover**: `shadow-lg ring-1 ring-black/5`
- No pure black shadows — always tinted or transparent

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
| Light bg (white/mist) — nav, sidebar | `asmos-logo-primary-lightbg.webp` |
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
- No `z-50` spam — use z-index scale: `10` sidebar/nav, `20` dropdowns, `30` modals, `40` toasts
- No `h-screen` for full-height layouts — use `min-h-[100dvh]`
- No `width: calc(33% - 1rem)` flex math — use CSS Grid

# Asmos Frontend Rebuild Report

**Branch:** `feature/onboarding-rebuild`
**Commit:** `a38ec49`
**Date:** 2026-07-29

---

## Phase 1 — PRODUCT.md + DESIGN.md

### Created files
- `/home/ubuntu/.openclaw/workspace/Asmos/PRODUCT.md` — product context, user profiles, brand tone, onboarding flow, copy rules, anti-patterns
- `/home/ubuntu/.openclaw/workspace/Asmos/apps/web/DESIGN.md` — full design system spec: color tokens, typography scale, spacing, border radius system, elevation, component specs, motion rules, logo usage guide

### Key decisions
- Registered product as `product` mode (app UI, not marketing)
- Documented all `--color-*` CSS vars for reference
- Added 4-step onboarding progress map (including new connect-store step)
- Listed all design anti-patterns to avoid (gradient text, side-stripe borders, nested cards, etc.)

---

## Phase 2 — Pre-auth Flow (6 screens)

### Screen 01: `/` (Homepage)
**File:** `apps/web/src/app/page.tsx`
**Component:** `apps/web/src/components/ui/HomepageForm.tsx`

- Full-bleed white layout, Asmos logo top-left
- Ambient radial gradient behind hero (CSS only, no external libs)
- `"Turn visitors into leads, automatically."` headline
- Pill eyebrow badge with live dot
- URL input + "Analyze my store" CTA as client form
- Normalizes URL (adds https:// if missing), validates before routing
- On submit: `router.push('/analyze?url=...')`
- Trust strip: "No credit card required · Free to start · 2-minute setup"
- Page enter animation: fadeSlideUp staggered at 0ms/60ms/120ms/180ms

**Screenshot:** `screenshots/homepage-after.png`

### Screen 02: `/analyze` (Live Analysis)
**Files:** `apps/web/src/app/analyze/page.tsx`, `apps/web/src/app/analyze/AnalyzeClient.tsx`
**API:** `apps/web/src/app/api/analyze/route.ts`

- `page.tsx` wraps client in `<Suspense>` (required by Next.js for `useSearchParams`)
- Spinning arc animation with inner pulse (pure CSS keyframes)
- 5 cycling step labels with 900ms interval
- Smooth progress bar driven by random increments up to 88%, then jumps to 100% on completion
- API route `GET /api/analyze?url=` fetches the URL, extracts: title/og:title (store name), meta description, og:image, theme-color (brand color), industry signals from HTML content
- Result stored in `sessionStorage.asmos_analyze_result`
- Auto-navigates to `/analyze/results` after 600ms post-completion
- Error state: styled error card with "Try again" button

**Screenshot:** `screenshots/analyze-after.png`

### Screen 03: `/analyze/results`
**File:** `apps/web/src/app/analyze/results/page.tsx`

- Pre-fills from `sessionStorage.asmos_analyze_result`
- Brand color swatch preview (14×14px rounded square, updates live)
- Editable store name input
- Industry dropdown
- Color picker with hex display
- `"Create your account"` CTA routes to `/sign-up`
- Stores confirmed data back to sessionStorage before routing

### Screen 04: `/sign-in` + `/sign-up`
**Files:** `apps/web/src/app/sign-in/[[...sign-in]]/page.tsx`, `apps/web/src/app/sign-up/[[...sign-up]]/page.tsx`

- Keeps Clerk `<SignIn>` and `<SignUp>` components (MOCK_AUTH compatible)
- Replaces plain `<StackedLogo>` wrapper with proper centered card layout
- Asmos stacked logo above, headline below, Clerk widget centered
- Cross-links between sign-in and sign-up
- `bg-[color:var(--color-surface-sunken)]` for form field contrast

### Screen 05: `/onboarding/business-profile`
**File:** `apps/web/src/app/onboarding/business-profile/page.tsx`

- Pre-fills `industry` and `brandColor` from `sessionStorage.asmos_analyze_result` if available
- Industry selector: 2-col (3-col on sm) visual card grid with emoji icon + label
- Active card: Asmos Blue border + light blue tint background
- Brand color UI: live preview swatch + 8 preset palette swatches + custom `<input type="color">`
- Color hex shown in monospace with `tabular-nums`
- Saves to `/api/onboarding/business-profile` then routes to `/onboarding/consent`

**Screenshot:** `screenshots/business-profile-after.png`

### Screen 06: `/onboarding/connect-store` (NEW)
**File:** `apps/web/src/app/onboarding/connect-store/page.tsx`

- New step added after consent in the flow
- Shows `<script>` widget snippet in dark code block with monospace font
- 3-tab switcher: Shopify / WordPress / Custom HTML (pill-style tabs)
- Platform-specific installation instructions for each tab
- Copy button with check icon + "Copied" confirmation state (2s timeout)
- "I've installed it" CTA routes to `/dashboard`
- Consent page updated to route here instead of dashboard directly

**Screenshot:** `screenshots/connect-store-after.png`

---

## Phase 3 — Design Polish

### Typography
- Migrated from `Inter` to `Geist` via `next/font/google`
- CSS var updated: `--font-sans: var(--font-geist)` in `@theme inline`
- Root `font-family` and `-webkit-font-smoothing: antialiased` in body

### CSS animations
Added to `globals.css` (gated behind `prefers-reduced-motion: no-preference`):
```css
@keyframes fadeSlideUp { from: opacity 0, translateY 10px; to: opacity 1, translateY 0 }
.animate-page-enter        { animation: fadeSlideUp 300ms ease-out }
.animate-page-enter-delay-1 { animation delay: 60ms }
.animate-page-enter-delay-2 { animation delay: 120ms }
.animate-page-enter-delay-3 { animation delay: 180ms }
```

### Onboarding progress bar
- 4 steps: Welcome / Business Profile / Compliance / Connect Store
- Completed steps show check icon (not step number)
- Active step label shown below indicator
- "Step X of 4" text caption

### Design tokens applied consistently
- All cards: `rounded-2xl` (not `rounded-xl`)
- Buttons: `active:scale-[0.98]` tactile press
- Focus rings: `focus:ring-2 focus:ring-[color:var(--color-primary)]/20`
- Numbers: `tabular-nums` class throughout
- Transitions: `transition-colors duration-150` (never `transition-all`)

---

## Phase 4 — Dashboard Rebuild

### `(dashboard)` layout
**File:** `apps/web/src/app/(dashboard)/layout.tsx`

- Fixed `h-[100dvh] overflow-hidden` shell (was `h-screen`)
- Top bar: 56px height, clean border-bottom, UserButton right-aligned
- Main area: `flex-1 overflow-y-auto px-6 py-6`

### Dashboard page
**File:** `apps/web/src/app/(dashboard)/dashboard/page.tsx`

- Reads live data from Prisma (campaigns, events, leads)
- 4 stat cards in `grid-cols-2 lg:grid-cols-4`
- Campaigns table: Name / Type / Status / Impressions / Conversions / Rate
- Status badges: "Live" (green) or "Draft" (neutral gray)
- Empty state: dashed border card with "+" icon and "Create campaign" CTA
- "New campaign" button in page header

### Sidebar
**File:** `apps/web/src/components/ui/Sidebar.tsx`

- SVG icon set (custom inline icons, consistent 16×16 stroke-1.5)
- Logo via `asmos-logo-primary-lightbg.webp` (not text)
- Active state: `bg-[color:var(--color-primary-light)] text-[color:var(--color-primary)]`
- Footer: "AI is optimizing" callout card in light blue tint
- No emoji in nav items

### StatCard
- Upgraded to `rounded-2xl shadow-sm`
- `tabular-nums` on value
- Trend color uses CSS var for success green

**Screenshot:** `screenshots/dashboard-after.png`

---

## Key Technical Decisions

| Decision | Rationale |
|---|---|
| `useSearchParams` wrapped in `<Suspense>` | Next.js App Router requirement for static prerender |
| `AnalyzeClient` split into separate file | Required for Suspense boundary — page.tsx stays server |
| sessionStorage for analyze data | No auth required yet; ephemeral cross-route state |
| `min-h-[100dvh]` not `h-screen` | Prevents iOS Safari address bar layout jump |
| Geist from `next/font/google` | Zero layout shift, self-hosted by Next.js |
| `transition-colors duration-150` not `transition-all` | Avoids expensive layout-property transitions |
| Industry as visual card grid | Reference 05 shows card-style picker, not plain dropdown |
| Pre-fill from sessionStorage | Reduces friction — detected brand flows forward into onboarding |
| `auth-adapter.ts`: `(as any).protect()` | Clerk v7 API change; protect() moved off returned object |

---

## Residual Gaps vs References

| Gap | Status | Notes |
|---|---|---|
| `/analyze/results` shows OG image / logo preview | Not implemented | `logoUrl` extracted but no `<img>` render — avoids CORS/broken-image issues |
| Dashboard stat cards have trend arrows vs reference | Simplified | Trend data needs real historical comparison period to be meaningful |
| Sidebar has no account switcher in top-right | Not implemented | Requires multi-account logic not yet in Phase 1 |
| Sign-in/up pages: Clerk widget styling | Clerk-controlled | Cannot fully override Clerk widget appearance without Clerk Appearance API setup |
| `/analyze/results` brand color swatch: full page preview | Partial | Shows color swatch, not full mock popup preview |
| `connect-store`: install verification (ping check) | Not implemented | Would require a backend queue check endpoint — Phase 2 scope |
| Dashboard shows mock data when no real campaigns exist | Intentional | Dev seed available via `/api/dev/seed` POST |

---

## Files Changed Summary

### New files
- `PRODUCT.md`
- `apps/web/DESIGN.md`
- `apps/web/src/app/analyze/page.tsx`
- `apps/web/src/app/analyze/AnalyzeClient.tsx`
- `apps/web/src/app/analyze/results/page.tsx`
- `apps/web/src/app/api/analyze/route.ts`
- `apps/web/src/app/onboarding/connect-store/page.tsx`
- `apps/web/src/components/ui/HomepageForm.tsx`
- `screenshots/` (5 verification screenshots)

### Modified files
- `apps/web/src/app/globals.css` — Geist var, page-enter animations
- `apps/web/src/app/layout.tsx` — Inter → Geist
- `apps/web/src/app/page.tsx` — full homepage rebuild
- `apps/web/src/app/sign-in/[[...sign-in]]/page.tsx` — improved wrapper
- `apps/web/src/app/sign-up/[[...sign-up]]/page.tsx` — improved wrapper
- `apps/web/src/app/onboarding/business-profile/page.tsx` — visual card industry selector + color picker
- `apps/web/src/app/onboarding/consent/page.tsx` — routes to connect-store
- `apps/web/src/app/onboarding/layout.tsx` — (unchanged structure)
- `apps/web/src/app/(dashboard)/layout.tsx` — dvh, overflow-hidden
- `apps/web/src/app/(dashboard)/dashboard/page.tsx` — polished table + empty state
- `apps/web/src/components/ui/OnboardingProgress.tsx` — 4 steps, check icons
- `apps/web/src/components/ui/Sidebar.tsx` — icons, logo, AI hint card
- `apps/web/src/components/ui/StatCard.tsx` — rounded-2xl, tabular-nums
- `apps/web/src/lib/auth-adapter.ts` — fix Clerk v7 type error

---

## Git

- **Branch:** `feature/onboarding-rebuild`
- **Commit:** `a38ec49`
- **PR URL:** https://github.com/tamazm/Asmos/pull/new/feature/onboarding-rebuild
- **Build:** All 33 routes compile clean (TypeScript + Turbopack production build verified)

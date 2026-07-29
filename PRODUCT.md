# Asmos — Product Context

## Product Purpose
Asmos is a popup + behavioral AI platform for e-commerce and SaaS businesses. It lets merchants launch on-site popups, capture leads, and run A/B experiments that automatically optimize toward the best-performing variant via bandit-based allocation.

## Register
**product** — the design serves the product (app UI, onboarding, dashboard, tool surfaces). The pre-auth landing/analyze screens lean brand/marketing but still sit within the product shell.

## Users
- Primary: E-commerce store owners (Shopify, WooCommerce, custom) who want more email signups and conversions
- Secondary: SaaS founders, marketing managers at SMBs
- Technical level: Low to medium. They can paste a `<script>` tag but aren't developers
- Mental model: "I want my popup to work better, not figure out statistics"

## Brand
- Name: asmos (lowercase in body copy, "Asmos" in formal/UI contexts)
- Logo: `asmos-logo-primary-lightbg.webp` on white/mist backgrounds; stacked variant for centered auth contexts
- Primary color: Asmos Blue `#165DFF`
- Tone: Confident, direct, intelligent. Not "startup-y" or hype-y. Speaks to results, not features.
- Anti-references: Generic purple-gradient SaaS, neon AI aesthetics, heavy glassmorphism, "we're disrupting" copy

## Anti-Patterns (Forbidden)
- No em dashes
- No gradient text (`background-clip: text`)
- No side-stripe accent borders
- No hero-metric template (big number, small label, gradient accent card grid)
- No identical card grids (icon + heading + text × N)
- No modal as first solution
- No purple/AI-glow by default (only Asmos Blue as accent)
- No inline emoji in UI copy

## Strategic Principles
1. **Clarity over cleverness** — every screen has one primary action
2. **Progressive disclosure** — don't ask for everything upfront
3. **Trust signals** — clean, professional, not scrappy
4. **Speed to value** — onboarding should feel like 3 steps, not 10

## Onboarding Flow
1. `/` — URL input (analyze my store)
2. `/analyze` — live scanning animation
3. `/analyze/results` — detected brand info, confirm
4. `/sign-up` or `/sign-in` — Clerk auth
5. `/onboarding/business-profile` — industry + brand color
6. `/onboarding/connect-store` — install snippet
7. `/dashboard` — main app

## Session Storage Keys
- `asmos_analyze_result` — `{ storeName, industry, brandColor, description, logoUrl, storeUrl }`

## Voice + Copy Rules
- Short imperatives for CTAs: "Analyze my store", "Create account", "Copy snippet"
- Subtext max 20 words
- No fluff intros that repeat the title
- Numbers must be real or clearly labeled as mock

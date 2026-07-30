# Asmos — Agent Notes

## Repo Structure
- `apps/web/` — Next.js 16 app (App Router, Turbopack, Prisma 7, Clerk auth)
- `apps/web/public/widget.js` — Vanilla JS IIFE deployed on customer sites
- `apps/web/prisma/schema.prisma` — Prisma schema (Postgres via `@prisma/adapter-pg`)
- `apps/web/src/generated/prisma/` — Generated Prisma client (do NOT edit directly)

## Build / Run Commands
```bash
cd apps/web
npm run dev           # starts Next.js dev server (predev runs prisma dev)
npm run build         # prisma generate + next build (TypeScript checked)
npx prisma generate   # regenerate client after schema changes
npx prisma migrate dev --name <name>  # run migration (requires DB access)
```

## Key Files
| File | Purpose |
|------|---------|
| `src/lib/analytics.ts` | PostHog event helpers (client-side) |
| `src/lib/posthog.tsx` | PostHog init (checks NEXT_PUBLIC_POSTHOG_KEY) |
| `src/components/PostHogPageView.tsx` | Auto page_view capture |
| `src/lib/bandit.ts` | Multi-armed bandit allocation (reads CampaignEvent) |
| `src/lib/stats.ts` | Confidence/significance math |
| `src/lib/email.ts` | Resend email integration |
| `public/widget.js` | Customer-site widget IIFE |

## PostHog Behavioral Tracking (feat/posthog-behavioral-tracking)
**Branch:** `feat/posthog-behavioral-tracking`

### Architecture
- **PostHog = observability layer** (not the bandit data source)
- **Bandit = Postgres CampaignEvent table** (unchanged)
- Widget events are proxied through `/api/widget/events` → forwarded to PostHog server-side
- This avoids loading PostHog SDK on customer sites

### What Was Built
1. **`CampaignEventType` enum** — added `DISMISSED` value in schema.prisma
2. **`/api/widget/events/route.ts`** — accepts behavioral context fields:
   - `pageUrl`, `referrer`, `utmSource`, `utmMedium`, `utmCampaign`
   - `scrollDepthPct`, `timeOnPageSeconds`, `dismissAfterMs`
   - Forwards to PostHog `https://eu.posthog.com/capture/` via `after()` (fire-and-forget)
   - Graceful no-op when `NEXT_PUBLIC_POSTHOG_KEY` not set
3. **`/api/widget/leads/route.ts`** — forwards `email_captured` event to PostHog
4. **`public/widget.js`** — behavioral context collection:
   - Captures `pageUrl`, `referrer` at load time
   - Parses UTM params from `window.location.search`
   - Tracks `maxScrollDepthPct` via debounced scroll listener
   - Tracks `timeOnPageSeconds` from widget init
   - Fires `DISMISSED` event + `dismissAfterMs` on close button click
   - Enriches all `trackEvent()` calls with behavioral context
5. **Dashboard call sites wired:**
   - `campaignCreated` — already wired in `campaigns/new/page.tsx`
   - `variantWinnerDeclared` — wired in `VariantManager.tsx` (campaign view)
   - `variantWinnerDeclared` — wired in `VariantDetailActions.tsx` (variant detail view)
   - `emailCaptured` — server-side via PostHog in `/api/widget/leads/route.ts`
   - `onboardingStepCompleted` — already wired in onboarding pages

### Env Var Required
```
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxx
```
PostHog EU endpoint: `https://eu.posthog.com`

### Known Pre-existing TS Errors (NOT our changes)
The `feat/outbound-webhooks` branch modified `apps/web/src/app/api/widget/leads/route.ts`
and `apps/web/src/app/api/campaigns/[id]/route.ts` to add webhook fields that don't exist
in this branch's Prisma schema. These errors will resolve when the outbound-webhooks branch
is merged and the schema migration for `webhookUrl/webhookSecret/webhookEnabled` runs.

## Multi-Branch Notes
There are 3 active feature branches off main:
- `main` — stable baseline
- `feat/posthog-behavioral-tracking` — this feature
- `feat/outbound-webhooks` — webhook dispatch for lead events

Be careful when switching branches — git checkout restores tracked files.
Work on `feat/posthog-behavioral-tracking` always; confirm with `git branch` before committing.

# Asmos — Web App

Next.js 16 (App Router, TypeScript, Tailwind v4). See [`../../asmos_road_map.md`](../../asmos_road_map.md), [`../../platform-page-map.md`](../../platform-page-map.md), and [`../../design-system.md`](../../design-system.md) for product/design context.

## Local setup

### 1. Database

The repo includes a baseline migration (`prisma/migrations/20260730000000_init/`). Any Postgres instance works — Neon, Supabase, local, or RDS.

```bash
# Apply all migrations to a fresh DB:
npx prisma migrate deploy
```

For subsequent schema changes, use:

```bash
npx prisma migrate dev --name describe_your_change
```

This generates a new SQL file in `prisma/migrations/` that gets committed to the repo. Do **not** use `db push` for tracked environments — it bypasses migration history.

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

All keys are documented with instructions inside `.env.example`. The only hard requirements to run locally are `DATABASE_URL` and either real Clerk keys or `MOCK_AUTH=true`.

### 3. Auth (Clerk)

`.env.local` has placeholder Clerk keys — sign-in/sign-up/dashboard routes will 500 until you:

1. Create a free app at [dashboard.clerk.com](https://dashboard.clerk.com)
2. Copy the Publishable Key and Secret Key into `.env.local`

### 4. Campaign generation (Anthropic API)

Campaigns are created by prompt, not a manual builder — `/campaigns/new` sends the merchant's prompt to Claude (`claude-opus-4-8`) with a JSON schema constraining the output to a full campaign config (copy, type, rewards, targeting). Set `ANTHROPIC_API_KEY` in `.env.local` (get one at [console.anthropic.com](https://console.anthropic.com)) or generation will 500.

### 5. Coupon emails (Resend)

When a widget lead claims a reward with an email address, `/api/widget/leads` sends it via Resend. Set `RESEND_API_KEY` in `.env.local` (get one at [resend.com](https://resend.com)) or delivery silently fails (the widget response/reward still works — email is best-effort).

### 6. Run

```bash
npm run dev
```

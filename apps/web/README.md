# Asmos — Web App

Next.js 16 (App Router, TypeScript, Tailwind v4). See [`../../asmos_road_map.md`](../../asmos_road_map.md), [`../../platform-page-map.md`](../../platform-page-map.md), and [`../../design-system.md`](../../design-system.md) for product/design context.

## Local setup

### 1. Database

A local Postgres dev server is already running via Prisma's built-in dev tool (no Docker needed):

```bash
npx prisma dev ls          # check status / get connection strings
npx prisma dev --name asmos-local --detach   # start it again if stopped
```

`.env` already points `DATABASE_URL` at this local server's direct TCP connection string. Schema is applied with:

```bash
npx prisma db push
```

Note: use `db push` for local iteration, not `migrate dev` — the lightweight local dev Postgres doesn't support the shadow-database step `migrate dev` needs. Switch to `migrate dev`/`migrate deploy` once there's a real hosted Postgres (Neon/Supabase/RDS) to track migration history against.

### 2. Auth (Clerk)

`.env.local` has placeholder Clerk keys — sign-in/sign-up/dashboard routes will 500 until you:

1. Create a free app at [dashboard.clerk.com](https://dashboard.clerk.com)
2. Copy the Publishable Key and Secret Key into `.env.local`

### 3. Campaign generation (Anthropic API)

Campaigns are created by prompt, not a manual builder — `/campaigns/new` sends the merchant's prompt to Claude (`claude-opus-4-8`) with a JSON schema constraining the output to a full campaign config (copy, type, rewards, targeting). Set `ANTHROPIC_API_KEY` in `.env.local` (get one at [console.anthropic.com](https://console.anthropic.com)) or generation will 500.

### 4. Coupon emails (Resend)

When a widget lead claims a reward with an email address, `/api/widget/leads` sends it via Resend. Set `RESEND_API_KEY` in `.env.local` (get one at [resend.com](https://resend.com)) or delivery silently fails (the widget response/reward still works — email is best-effort).

### 5. Run

```bash
npm run dev
```

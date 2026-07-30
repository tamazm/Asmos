# AGENT_NOTES.md — Asmos Repo

## Stack
- **Framework:** Next.js 16 (App Router, Turbopack)
- **ORM:** Prisma 7 with PostgreSQL
- **Auth:** Clerk (or mock via `MOCK_AUTH=true`)
- **Monorepo root:** `/home/ubuntu/.openclaw/workspace/Asmos`
- **Web app:** `apps/web/`
- **Build:** `cd apps/web && npm run build` (runs `prisma generate && next build`)

## Key Files
| File | Purpose |
|---|---|
| `prisma/schema.prisma` | Prisma schema — source of truth for DB models |
| `src/lib/auth-adapter.ts` | Clerk/mock auth proxy — always import `auth()` / `currentUser()` from here |
| `src/lib/account.ts` | `getOrCreateAccount()` — resolves current user's account |
| `src/lib/prisma.ts` | Prisma client singleton |
| `src/lib/bandit.ts` | Thompson sampling bandit — recomputes variant traffic weights |
| `src/lib/email.ts` | Reward email sender (Resend) |
| `src/lib/webhook.ts` | **NEW** — outbound webhook dispatch (HMAC-SHA256 signed) |
| `src/app/api/widget/leads/route.ts` | Widget lead capture POST — CORS open, no auth |
| `src/app/api/account/webhook/route.ts` | **NEW** — GET/PATCH webhook config (auth-gated) |

## Outbound Webhooks (feat/outbound-webhooks)
### What was built
- `Account` model got three new fields: `webhookUrl`, `webhookSecret`, `webhookEnabled`
- `src/lib/webhook.ts` — fire-and-forget `dispatchWebhook()` with HMAC-SHA256 signing
- `GET /api/account/webhook` — returns config (secret masked to last 4 chars)
- `PATCH /api/account/webhook` — saves URL (https-only validated), secret, enabled flag
- Widget `POST /api/widget/leads` fires `lead.captured` event via `after()` — non-fatal, never blocks response
- Campaign `PATCH /api/campaigns/[id]` fires `variant.winner_declared` event via `after()` when `winningVariantId` is set
- Integrations UI webhooks card now uses real API (load on mount + save/disconnect)

### Migration note
DB migration was NOT run (no DB connection in CI environment).
Migration file needs to be applied when DB is available:
```
cd apps/web && npx prisma migrate dev --name add_webhook_config
```
Or use `prisma db push` for non-production envs.

### Webhook payload format
**lead.captured:**
```json
{
  "event": "lead.captured",
  "payload": {
    "campaign_id": "...",
    "campaign_name": "...",
    "variant_id": "...",
    "variant_name": "...",
    "lead": { "email": "...", "name": "...", "phone": "...", "consent_given": true, "captured_at": "ISO" },
    "reward": { "label": "...", "type": "COUPON", "coupon_code": "..." } | null
  }
}
```

**variant.winner_declared:**
```json
{
  "event": "variant.winner_declared",
  "payload": {
    "campaign_id": "...",
    "campaign_name": "...",
    "winning_variant_id": "...",
    "winning_variant_name": "...",
    "declared_at": "ISO"
  }
}
```

### Security
Every request includes:
- `X-Asmos-Signature: sha256=<hmac>` (when secret is set)
- `X-Asmos-Timestamp: <epoch_ms>`
- `X-Asmos-Event: lead.captured | variant.winner_declared`

### Design decisions
- **Fire-and-forget** via `after()` — slow/dead endpoints never block widget response
- **HTTPS-only** — enforced at save time in `/api/account/webhook`
- **No retries in v1** — log failures, retry queue is future work
- **Single webhook URL per account** — covers Klaviyo/Mailchimp/HubSpot via Zapier relay

## Build Commands
```bash
cd apps/web
npm run build     # prisma generate + next build
npm run dev       # dev server
npx prisma studio # DB browser (when DB is available)
```

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk pub key
- `CLERK_SECRET_KEY` — Clerk secret
- `MOCK_AUTH=true` — bypass Clerk in dev/testing
- `RESEND_API_KEY` — reward email sending
- `NEXT_PUBLIC_POSTHOG_KEY` — PostHog analytics (optional)

# Shopify Integration Plan (App Store)

## Context
Turning the existing Shopify **embedded app foundation ("B1")** into a full App Store
listing where a merchant installs → chooses what Asmos may track → gets popups on the
storefront, all customizable. Target flow: OAuth (managed install) → auto-authorize →
per-feature consent toggles → data actions → storefront popups → full customization.

## Locked decisions (2026-08-26)
- **Admin surface:** embedded — *reuse the existing React dashboard* inside the Shopify
  iframe under `/shopify-admin`, authed by Shopify session token. **Not** a Polaris rebuild.
- **Account model:** shop = the account (Clerk-less auto-provision, as B1 already does). No
  account-linking flow.
- **Goal:** public App Store listing → theme app extension, real GDPR deletion, Shopify
  Billing, and CSP `frame-ancestors` are hard requirements.
- **Defaults:** all 3 data scopes optional · attribution via popup discount code · Billing
  wired, price points left as config.
- **Branch:** `feature/shopify-app-store`.

---

## What's DONE

**B1 foundation (on `main`, commit `0d1feaf`):**
- OAuth install `/api/shopify/install` → `/api/shopify/callback` (offline token, `@shopify/shopify-api`)
- Embedded session auth `/api/shopify/session` (App Bridge **token exchange**)
- Tenant provisioning `getOrCreateAccountForShop()` → `Account` + encrypted `ShopifyShop`
- Webhooks `/api/shopify/webhooks` (HMAC-verified; `app/uninstalled` handled)
- Embedded shell `/shopify-admin` (App Bridge + Polaris via Shopify CDN — correct)
- `shopify.app.toml` deployed, managed install on; dev store `adsa-fsawegdn.myshopify.com`

**② started (this branch):**
- `apps/web/next.config.ts` — added `headers()` with `frame-ancestors https://admin.shopify.com https://*.myshopify.com`, scoped to `/shopify-admin*` and `/api/shopify/*` only
- `apps/web/shopify.app.toml` — moved `read_customers,read_orders,read_products` into `optional_scopes`; required `scopes = ""`

---

## What's LEFT — how, exactly

### ② Finish config & hygiene
- **You:** put real `SHOPIFY_API_SECRET` in `apps/web/.env.local` (still placeholder); remove
  stale `SHOPIFY_REDIRECT_URI`, `SHOPIFY_OAUTH_STATE_SECRET`, `write_script_tags` from `.env`.
- Annotate `.env.example` that scopes are TOML-managed; `SHOPIFY_SCOPES` only affects legacy `/install`.
- Retire the "shopify" entry in the `integrationCredentials` facade list (`api/account/integrations/route.ts`) to avoid confusion.

### ① Theme app extension — storefront delivery ⚠️ URGENT (ScriptTag dies 2026-10-01)
- Create `apps/web/extensions/asmos-popup/`: `shopify.extension.toml`, `blocks/asmos-popup.liquid`
  (app **embed** block, `target: body`), `assets/asmos-embed.js`, `locales/en.default.json`.
- Embed injects the widget with the shop key: `data-asmos-shop="{{ shop.permanent_domain }}"`.
- `shopify app deploy`; after install deep-link the merchant to the theme editor with the embed
  pre-activated (embeds are off by default; app can't self-activate).

### ④ Config resolution by shop (makes ① actually render)
- Schema: add `ShopifyShop.websiteId` → `Website`; create/link a `Website` for the shop on install
  (in `tenant.ts` `getOrCreateAccountForShop`). New raw-SQL migration under `prisma/migrations/`.
- `apps/web/src/app/api/widget/config/route.ts`: resolve by **shop domain**
  (ShopifyShop → Account → Website → active Campaigns), in addition to hostname.
- `public/widget/asmos-widget.js`: read `data-asmos-shop` and pass it to the config call.

### ③ Auth unification (keystone for reusing the UI)
- On embedded load: `shopify.idToken()` → `/api/shopify/session` sets a signed httpOnly cookie
  binding browser → `shopDomain` → `accountId`.
- Extend `apps/web/src/lib/auth-adapter.ts` with a Shopify-session mode; add
  `getAccountForEmbeddedRequest()` mirroring `getOrCreateAccount()`.
- Refactor `(dashboard)` data-loading so components resolve the Account via a context-agnostic
  helper (Clerk **or** Shopify session), so the same UI mounts under `/shopify-admin/*`.

### ⑤ Embedded admin = the product (reuse components)
- Screens under `/shopify-admin/*`: onboarding (enable popups → pick goal → generate first via
  existing `generateCampaign`), campaign list/builder/preview/analytics (reuse dashboard components).
- **"What you'll allow" toggles:** App Bridge Scopes API — `shopify.scopes.query()` for state,
  `request([...])` / `revoke([...])` per feature; persist per-shop feature flags (extend
  `ShopifyShop` or a settings row). Each granted scope enables its webhook.

### ⑥ Data actions
- Add webhook subscriptions to `shopify.app.toml`: `orders/create`, `orders/paid`, `customers/create`.
- Handle in `/api/shopify/webhooks` → enqueue **Inngest** jobs → map to Asmos:
  match the popup-issued `CouponCode` against `orders/paid` to attribute revenue to the Variant
  (feed bandit/analytics); optionally create/enrich a `Lead` on `customers/create`.
- Build `/api/shopify/admin/*` on the existing (unused) `withShopifySession` for on-demand reads.

### ⑦ App Store readiness
- Implement real data handling in the 3 compliance webhooks (`customers/data_request`,
  `customers/redact`, `shop/redact`) — currently log-only (review blocker).
- Shopify **Billing API** (managed pricing or `appSubscriptionCreate`) — replace "Stripe coming soon".
- Run `shopify-app-store-review` skill; verify App Bridge + session-token auth on every embedded route.

---

## Human-gated (blocks live testing, not code)
`SHOPIFY_API_SECRET` in `.env.local` · one `shopify app dev` (interactive CLI login) · enable the
theme embed in the store · Billing plan + listing + submission in Partner Dashboard.
Dev store already exists: `adsa-fsawegdn.myshopify.com`.

## Verification
Without a store: `compiles + typechecks + unit-tested + review-skill audit`.
With store (after the two unblocks): install → managed-install consent → embedded admin renders →
popup shows on storefront → `orders/paid` attributes back to the Variant.

## Suggested order
② + ① in parallel first (① is deadline-driven) → ④ (makes ① render) → ③ → ⑤ → ⑥ → ⑦.

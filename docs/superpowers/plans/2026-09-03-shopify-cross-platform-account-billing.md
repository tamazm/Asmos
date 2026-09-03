# Shopify Cross-Platform Account & Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Asmos's cross-platform account model App-Store-compliant and edge-case-safe: one account per merchant across Shopify and web, exactly one active billing rail (Stripe **or** Shopify, never both), a seamless embed→web handoff with no login wall, and no data loss when a Shopify-first merchant links to a web account.

**Architecture:** Three independently-shippable parts. **Part A** adds a `billingSource` discriminator to `Account`, persists Shopify subscription state onto the account (so entitlements reflect Shopify-paid plans), and guards both checkout endpoints against double billing. **Part B** adds a one-time SSO handoff token so the embed can open the web dashboard already-authenticated (no Clerk wall). **Part C** hardens `linkShopToAccount` so merging a Shopify-first account into a web account migrates campaigns instead of orphaning/deleting them, and refuses merges that would double-bill.

**Tech Stack:** Next.js (App Router, route handlers), Prisma (Postgres), `@shopify/shopify-api`, Stripe, Vitest. Existing crypto: AES-256-GCM `encryptSecret`/`decryptSecret` (`src/lib/crypto.ts`).

**Scope note:** The three parts are separable and each produces working, testable software on its own. Recommended ship order: **A → C → B** (A closes the money/compliance risk; C prevents data loss that B's traffic makes more likely; B is the UX/compliance polish). They can also ship in separate PRs.

**Conventions in this codebase (follow exactly):**
- Tests are Vitest. Run a single file with `npx vitest run <path>`. Modules that touch Prisma/Shopify are unit-tested by mocking with `vi.mock(...)` at the top of the test file (see `src/lib/shopify/discounts.test.ts` for the canonical pattern).
- Route handlers return `Response.json(...)`; embedded routes authenticate via `getEmbeddedAccount(request)` or `verifySessionToken(request)`, **never** Clerk `auth()`.
- Prisma client import: `import { prisma } from "@/lib/prisma"`.
- Enums import from `@prisma/client`.
- Commit after every green test. Commit messages: `feat:` / `fix:` / `test:` prefix.

---

## File Structure

**Part A — Billing precedence & Shopify entitlement sync**
- Modify: `apps/web/prisma/schema.prisma` — add `BillingSource` enum + `Account.billingSource` + `Account.shopifySubscriptionId`.
- Create: `apps/web/prisma/migrations/<ts>_add_billing_source/migration.sql` (generated).
- Create: `apps/web/src/lib/billing/source.ts` — pure precedence helpers (single source of truth).
- Create: `apps/web/src/lib/billing/source.test.ts`.
- Create: `apps/web/src/lib/shopify/billingSync.ts` — map + persist Shopify sub → Account.
- Create: `apps/web/src/lib/shopify/billingSync.test.ts`.
- Modify: `apps/web/shopify.app.toml` — declare `app_subscriptions/update` webhook.
- Modify: `apps/web/src/app/api/shopify/webhooks/route.ts` — handle `app_subscriptions/update`; defensive downgrade on `app/uninstalled`.
- Modify: `apps/web/src/app/api/shopify/admin/billing/route.ts` — guard POST; expose `managedElsewhere` on GET.
- Modify: `apps/web/src/app/api/billing/checkout/route.ts` — guard against active Shopify rail.
- Modify: `apps/web/src/app/api/webhooks/stripe/route.ts` — set/clear `billingSource` on Stripe events.
- Modify: `apps/web/src/app/(dashboard)/settings/page.tsx` — compute `isShopify` from `billingSource`.

**Part B — Seamless SSO handoff**
- Create: `apps/web/src/lib/shopify/ssoToken.ts` — mint/verify one-time handoff token.
- Create: `apps/web/src/lib/shopify/ssoToken.test.ts`.
- Modify: `apps/web/src/lib/shopify/session-cookie.ts` — add `setFirstPartyShopSessionCookie`.
- Create: `apps/web/src/app/api/shopify/admin/handoff/route.ts` — mint handoff URL (session-token authed).
- Create: `apps/web/src/app/api/shopify/sso/route.ts` — exchange token → first-party cookie → redirect.
- Modify: `apps/web/src/app/shopify-admin/page.tsx` — route top-frame dashboard links through the handoff.

**Part C — Link-merge data integrity**
- Modify: `apps/web/src/lib/shopify/tenant.ts` — `linkShopToAccount`: billing-conflict guard + campaign migration + safer delete.
- Create: `apps/web/src/lib/shopify/tenant.link.test.ts`.

---

# PART A — Billing precedence & Shopify entitlement sync

### Task A1: Add `BillingSource` to the data model

**Files:**
- Modify: `apps/web/prisma/schema.prisma` (enum block near line 19; `Account` model near line 120)

- [ ] **Step 1: Add the enum**

In `apps/web/prisma/schema.prisma`, directly after the `SubscriptionStatus` enum (near line 26-31), add:

```prisma
// Which billing rail currently "owns" an account. An account is billed through
// exactly one rail at a time: STRIPE for web-acquired merchants, SHOPIFY for
// merchants billed via the Shopify Billing API (App Store requirement). NONE =
// no paid subscription on either rail (free plan).
enum BillingSource {
  NONE
  STRIPE
  SHOPIFY
}
```

- [ ] **Step 2: Add the fields to `Account`**

In the `Account` model, replace the existing billing block (near lines 120-122):

```prisma
  planTier           PlanTier           @default(FREE)
  subscriptionStatus SubscriptionStatus @default(TRIALING)
  stripeCustomerId   String?            @unique
```

with:

```prisma
  planTier           PlanTier           @default(FREE)
  subscriptionStatus SubscriptionStatus @default(TRIALING)
  stripeCustomerId   String?            @unique

  // The rail that currently owns this account's paid plan. Guards against
  // double-billing (see src/lib/billing/source.ts) and tells the settings UI
  // which controls to show. Shopify billing writes this via the
  // app_subscriptions/update webhook; Stripe billing writes it via its webhook.
  billingSource         BillingSource @default(NONE)
  // The Shopify AppSubscription GID (admin_graphql_api_id) when billingSource is
  // SHOPIFY. Lets the uninstall/downgrade path and reconciliation match the sub.
  shopifySubscriptionId String?
```

- [ ] **Step 3: Generate the migration**

Run: `cd apps/web && npx prisma migrate dev --name add_billing_source`
Expected: creates `prisma/migrations/<timestamp>_add_billing_source/migration.sql` containing `CREATE TYPE "BillingSource"` and `ALTER TABLE "Account" ADD COLUMN "billingSource"` + `"shopifySubscriptionId"`, and regenerates the Prisma client. If the local DB is unreachable, run `npx prisma migrate dev --name add_billing_source --create-only` to author the SQL, then apply later; still run `npx prisma generate` so the client types include `BillingSource`.

- [ ] **Step 4: Verify the client type exists**

Run: `cd apps/web && node -e "const {BillingSource}=require('@prisma/client'); console.log(BillingSource)"`
Expected: prints `{ NONE: 'NONE', STRIPE: 'STRIPE', SHOPIFY: 'SHOPIFY' }`

- [ ] **Step 5: Commit**

```bash
git add apps/web/prisma/schema.prisma apps/web/prisma/migrations
git commit -m "feat: add BillingSource discriminator to Account"
```

---

### Task A2: Precedence helpers (single source of truth)

**Files:**
- Create: `apps/web/src/lib/billing/source.ts`
- Test: `apps/web/src/lib/billing/source.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/billing/source.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isRailActive, canStartStripeCheckout, canStartShopifyCharge } from "./source";

const base = { billingSource: "NONE" as const, planTier: "FREE" as const, subscriptionStatus: "TRIALING" as const };

describe("isRailActive", () => {
  it("is false when no rail owns the account", () => {
    expect(isRailActive(base)).toBe(false);
  });
  it("is true for an owning status on a real rail", () => {
    expect(isRailActive({ ...base, billingSource: "STRIPE", subscriptionStatus: "ACTIVE" })).toBe(true);
    expect(isRailActive({ ...base, billingSource: "SHOPIFY", subscriptionStatus: "TRIALING" })).toBe(true);
    expect(isRailActive({ ...base, billingSource: "SHOPIFY", subscriptionStatus: "PAST_DUE" })).toBe(true);
  });
  it("is false once the rail's subscription is canceled", () => {
    expect(isRailActive({ ...base, billingSource: "STRIPE", subscriptionStatus: "CANCELED" })).toBe(false);
  });
});

describe("checkout guards", () => {
  it("blocks Stripe checkout when Shopify actively owns the account", () => {
    expect(canStartStripeCheckout({ ...base, billingSource: "SHOPIFY", subscriptionStatus: "ACTIVE" })).toBe(false);
  });
  it("allows Stripe checkout when Shopify sub is canceled", () => {
    expect(canStartStripeCheckout({ ...base, billingSource: "SHOPIFY", subscriptionStatus: "CANCELED" })).toBe(true);
  });
  it("blocks Shopify charge when Stripe actively owns the account", () => {
    expect(canStartShopifyCharge({ ...base, billingSource: "STRIPE", subscriptionStatus: "ACTIVE" })).toBe(false);
  });
  it("allows each rail when the account is free (NONE)", () => {
    expect(canStartStripeCheckout(base)).toBe(true);
    expect(canStartShopifyCharge(base)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/billing/source.test.ts`
Expected: FAIL — `Cannot find module './source'`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/lib/billing/source.ts`:

```ts
import type { PlanTier, SubscriptionStatus, BillingSource } from "@prisma/client";

// The minimal billing shape these helpers reason about. Any object with these
// three fields (an Account row, or a test fixture) works — keeps the helpers
// pure and trivially unit-testable.
export type AccountBillingFields = {
  billingSource: BillingSource;
  planTier: PlanTier;
  subscriptionStatus: SubscriptionStatus;
};

// A rail "owns" an account while its subscription is in any non-terminal state.
// PAST_DUE is intentionally included: the merchant still has a live billing
// relationship on that rail (the processor is retrying the charge), so we must
// not let a second rail be opened underneath it.
const OWNING_STATUSES: SubscriptionStatus[] = ["ACTIVE", "TRIALING", "PAST_DUE"];

export function isRailActive(a: AccountBillingFields): boolean {
  return a.billingSource !== "NONE" && OWNING_STATUSES.includes(a.subscriptionStatus);
}

// True unless Shopify actively owns the account. Called before creating a Stripe
// Checkout session so a Shopify-billed merchant can never open a second rail.
export function canStartStripeCheckout(a: AccountBillingFields): boolean {
  return !(a.billingSource === "SHOPIFY" && isRailActive(a));
}

// True unless Stripe actively owns the account. Called before creating a Shopify
// app subscription so a Stripe-billed merchant is never double-charged.
export function canStartShopifyCharge(a: AccountBillingFields): boolean {
  return !(a.billingSource === "STRIPE" && isRailActive(a));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/billing/source.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/billing/source.ts apps/web/src/lib/billing/source.test.ts
git commit -m "feat: add billing-rail precedence helpers"
```

---

### Task A3: Persist Shopify subscription state onto the Account

**Files:**
- Create: `apps/web/src/lib/shopify/billingSync.ts`
- Test: `apps/web/src/lib/shopify/billingSync.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/shopify/billingSync.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shopifyShop: { findUnique: vi.fn() },
    account: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { mapShopifySubStatus, mapShopifyPlanName, applyShopifySubscription } from "./billingSync";

const findShop = (prisma.shopifyShop as any).findUnique as ReturnType<typeof vi.fn>;
const findAccount = (prisma.account as any).findUnique as ReturnType<typeof vi.fn>;
const updateAccount = (prisma.account as any).update as ReturnType<typeof vi.fn>;

beforeEach(() => {
  findShop.mockReset();
  findAccount.mockReset();
  updateAccount.mockReset();
});

describe("mapShopifySubStatus", () => {
  it("maps Shopify statuses to internal enum", () => {
    expect(mapShopifySubStatus("ACTIVE")).toBe("ACTIVE");
    expect(mapShopifySubStatus("PENDING")).toBe("TRIALING");
    expect(mapShopifySubStatus("FROZEN")).toBe("PAST_DUE");
    expect(mapShopifySubStatus("CANCELLED")).toBe("CANCELED");
    expect(mapShopifySubStatus("EXPIRED")).toBe("CANCELED");
    expect(mapShopifySubStatus("anything-else")).toBe("CANCELED");
  });
});

describe("mapShopifyPlanName", () => {
  it("maps plan display names to tiers", () => {
    expect(mapShopifyPlanName("Asmos Scale")).toBe("SCALE");
    expect(mapShopifyPlanName("Asmos Growth")).toBe("GROWTH");
    expect(mapShopifyPlanName("Mystery")).toBe("FREE");
  });
});

describe("applyShopifySubscription", () => {
  it("writes an active Shopify plan onto the shop's account", async () => {
    findShop.mockResolvedValue({ accountId: "acc_1" });
    findAccount.mockResolvedValue({ billingSource: "NONE", subscriptionStatus: "TRIALING" });
    await applyShopifySubscription("s.myshopify.com", {
      admin_graphql_api_id: "gid://shopify/AppSubscription/9",
      name: "Asmos Growth",
      status: "ACTIVE",
    });
    expect(updateAccount).toHaveBeenCalledWith({
      where: { id: "acc_1" },
      data: {
        billingSource: "SHOPIFY",
        subscriptionStatus: "ACTIVE",
        planTier: "GROWTH",
        shopifySubscriptionId: "gid://shopify/AppSubscription/9",
      },
    });
  });

  it("downgrades to NONE/FREE when the Shopify sub is cancelled", async () => {
    findShop.mockResolvedValue({ accountId: "acc_1" });
    findAccount.mockResolvedValue({ billingSource: "SHOPIFY", subscriptionStatus: "ACTIVE" });
    await applyShopifySubscription("s.myshopify.com", { name: "Asmos Growth", status: "CANCELLED" });
    expect(updateAccount).toHaveBeenCalledWith({
      where: { id: "acc_1" },
      data: {
        billingSource: "NONE",
        subscriptionStatus: "CANCELED",
        planTier: "FREE",
        shopifySubscriptionId: null,
      },
    });
  });

  it("does not clobber an account actively billed by Stripe", async () => {
    findShop.mockResolvedValue({ accountId: "acc_1" });
    findAccount.mockResolvedValue({ billingSource: "STRIPE", subscriptionStatus: "ACTIVE" });
    await applyShopifySubscription("s.myshopify.com", { name: "Asmos Growth", status: "ACTIVE" });
    expect(updateAccount).not.toHaveBeenCalled();
  });

  it("no-ops when the shop is unknown", async () => {
    findShop.mockResolvedValue(null);
    await applyShopifySubscription("ghost.myshopify.com", { status: "ACTIVE" });
    expect(updateAccount).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/shopify/billingSync.test.ts`
Expected: FAIL — `Cannot find module './billingSync'`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/lib/shopify/billingSync.ts`:

```ts
import type { PlanTier, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isRailActive } from "@/lib/billing/source";

// Shopify AppSubscription.status (uppercase in the app_subscriptions/update
// webhook payload) -> our internal SubscriptionStatus.
export function mapShopifySubStatus(status: string): SubscriptionStatus {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE":
      return "ACTIVE";
    case "PENDING":
      return "TRIALING"; // created, awaiting approval / in trial
    case "FROZEN":
      return "PAST_DUE"; // payment problem, Shopify retrying
    case "CANCELLED":
    case "DECLINED":
    case "EXPIRED":
    default:
      return "CANCELED";
  }
}

// Shopify plan display name -> PlanTier. Names come from the PLANS catalog in
// lib/shopify/billing.ts ("Asmos Growth", "Asmos Scale"). Substring match so a
// future rename that keeps the tier word still resolves.
export function mapShopifyPlanName(name: string): PlanTier {
  const n = (name || "").toLowerCase();
  if (n.includes("scale")) return "SCALE";
  if (n.includes("growth")) return "GROWTH";
  return "FREE";
}

type AppSubscriptionPayload = {
  admin_graphql_api_id?: string;
  name?: string;
  status?: string;
};

// Persist a Shopify app-subscription state change onto the shop's Account so the
// app's own entitlement checks (lib/limits.ts reads Account.planTier) reflect a
// Shopify-billed plan. Idempotent — safe to call for every app_subscriptions/update
// webhook. Refuses to overwrite an account that Stripe actively owns (that would
// mean a double-billing anomaly the create-guards should have prevented; we log
// and leave Stripe as the owner rather than silently flip the rail).
export async function applyShopifySubscription(
  shopDomain: string,
  subscription: AppSubscriptionPayload,
): Promise<void> {
  const shop = await prisma.shopifyShop.findUnique({
    where: { shopDomain },
    select: { accountId: true },
  });
  if (!shop) return;

  const account = await prisma.account.findUnique({
    where: { id: shop.accountId },
    select: { billingSource: true, subscriptionStatus: true },
  });
  if (!account) return;

  // Defensive: never let a stray Shopify webhook clobber an active Stripe rail.
  if (
    account.billingSource === "STRIPE" &&
    isRailActive({ billingSource: "STRIPE", planTier: "FREE", subscriptionStatus: account.subscriptionStatus })
  ) {
    console.warn(
      `[shopify/billingSync] ignoring Shopify sub update for ${shopDomain}: account ${shop.accountId} is actively billed by Stripe`,
    );
    return;
  }

  const status = mapShopifySubStatus(subscription.status ?? "");
  const active = status === "ACTIVE" || status === "TRIALING" || status === "PAST_DUE";
  const planTier: PlanTier = active ? mapShopifyPlanName(subscription.name ?? "") : "FREE";

  await prisma.account.update({
    where: { id: shop.accountId },
    data: {
      billingSource: active ? "SHOPIFY" : "NONE",
      subscriptionStatus: status,
      planTier,
      shopifySubscriptionId: active ? subscription.admin_graphql_api_id ?? null : null,
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/shopify/billingSync.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/shopify/billingSync.ts apps/web/src/lib/shopify/billingSync.test.ts
git commit -m "feat: persist Shopify subscription state onto Account"
```

---

### Task A4: Subscribe to `app_subscriptions/update` and handle it

**Files:**
- Modify: `apps/web/shopify.app.toml`
- Modify: `apps/web/src/app/api/shopify/webhooks/route.ts`

- [ ] **Step 1: Declare the webhook (no scope required, so static declaration is allowed)**

In `apps/web/shopify.app.toml`, after the existing `app/uninstalled` subscription block (near lines 31-33), add:

```toml
[[webhooks.subscriptions]]
topics = ["app_subscriptions/update"]
uri = "https://app.asmos.io/api/shopify/webhooks"
```

- [ ] **Step 2: Handle the topic in the webhook route**

In `apps/web/src/app/api/shopify/webhooks/route.ts`, add the import at the top (after the existing `compliance` import on line 4):

```ts
import { applyShopifySubscription } from "@/lib/shopify/billingSync";
```

Then in the `switch (topic)` block, replace the existing `app/uninstalled` case (lines 32-38) with:

```ts
    case "app/uninstalled": {
      await prisma.shopifyShop.updateMany({
        where: { shopDomain },
        data: { uninstalledAt: new Date() },
      });
      // Defensive downgrade: Shopify auto-cancels the app subscription on
      // uninstall and should also fire app_subscriptions/update, but if that
      // event is missed we must not leave the account entitled to a plan it no
      // longer pays for. Only touch accounts this shop was billing.
      await prisma.account.updateMany({
        where: { shopifyShop: { shopDomain }, billingSource: "SHOPIFY" },
        data: { billingSource: "NONE", planTier: "FREE", subscriptionStatus: "CANCELED", shopifySubscriptionId: null },
      });
      break;
    }
```

And add a new case alongside the others (e.g. after the `customers/create` case, before `default`):

```ts
    case "app_subscriptions/update": {
      await applyShopifySubscription(shopDomain, payload?.app_subscription ?? {});
      break;
    }
```

- [ ] **Step 3: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors from the edited files.

- [ ] **Step 4: Deploy the app config so the subscription registers**

This is a deploy-time action, not code: after merge, run `shopify app deploy` so the new `app_subscriptions/update` subscription is registered with Shopify. Note it in the PR description. (No test — validated in staging by triggering a test charge and confirming the webhook hits the endpoint.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/shopify.app.toml apps/web/src/app/api/shopify/webhooks/route.ts
git commit -m "feat: sync Shopify billing via app_subscriptions/update webhook"
```

---

### Task A5: Guard the Shopify charge endpoint and expose `managedElsewhere`

**Files:**
- Modify: `apps/web/src/app/api/shopify/admin/billing/route.ts`

- [ ] **Step 1: Rewrite the route to resolve the full account and apply the guard**

Replace the entire contents of `apps/web/src/app/api/shopify/admin/billing/route.ts` with:

```ts
import { prisma } from "@/lib/prisma";
import { getEmbeddedAccount } from "@/lib/shopify/embeddedAuth";
import { getActiveSubscription, createSubscription, PLANS } from "@/lib/shopify/billing";
import { canStartShopifyCharge } from "@/lib/billing/source";

const APP_URL = process.env.SHOPIFY_APP_URL || "https://app.asmos.io";

// Resolve the embedded merchant's account AND its shop domain in one place.
async function resolve(request: Request) {
  const account = await getEmbeddedAccount(request);
  if (!account) return null;
  const shop = await prisma.shopifyShop.findUnique({
    where: { accountId: account.id },
    select: { shopDomain: true },
  });
  if (!shop) return null;
  return { account, shopDomain: shop.shopDomain };
}

// GET — current subscription status for the embedded merchant.
export async function GET(request: Request): Promise<Response> {
  const ctx = await resolve(request);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const plans = Object.values(PLANS).map((p) => ({
    key: p.key,
    name: p.name,
    amount: p.amount,
    currencyCode: p.currencyCode,
    interval: p.interval,
    trialDays: p.trialDays ?? null,
  }));

  // If this account is actively billed by Stripe (web-first merchant who later
  // connected their store), the embed must NOT offer a Shopify charge — that
  // would double-bill and violates "one rail per account". Show it read-only.
  if (!canStartShopifyCharge(ctx.account)) {
    return Response.json({
      managedElsewhere: true,
      planTier: ctx.account.planTier,
      subscriptionStatus: ctx.account.subscriptionStatus,
      plans,
      subscription: null,
    });
  }

  const subscription = await getActiveSubscription(ctx.shopDomain);
  return Response.json({ managedElsewhere: false, subscription, plans });
}

// POST { plan } — start a Shopify subscription; returns the confirmationUrl.
export async function POST(request: Request): Promise<Response> {
  const ctx = await resolve(request);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Hard guard: refuse to create a Shopify charge while Stripe actively owns
  // the account. Belt-and-suspenders with the GET read-only state above.
  if (!canStartShopifyCharge(ctx.account)) {
    return Response.json(
      {
        error:
          "Your Asmos plan is billed by card and managed in Asmos. Manage or cancel it there before switching to Shopify billing.",
        managedElsewhere: true,
      },
      { status: 409 },
    );
  }

  let planKey = "growth";
  try {
    const body = await request.json();
    if (body?.plan) planKey = String(body.plan);
  } catch {
    /* default plan */
  }

  const plan = PLANS[planKey];
  if (!plan) return Response.json({ error: `Unknown plan: ${planKey}` }, { status: 400 });

  const returnUrl = `${APP_URL}/shopify-admin?billing=done`;
  const test = process.env.NODE_ENV !== "production";

  try {
    const { confirmationUrl } = await createSubscription(ctx.shopDomain, plan, returnUrl, test);
    return Response.json({ confirmationUrl });
  } catch (err) {
    console.error("[shopify/admin/billing] createSubscription failed", err);
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
```

- [ ] **Step 2: Update the embed UI to honor `managedElsewhere`**

In `apps/web/src/app/shopify-admin/page.tsx`, find the `loadBilling` callback (near lines 190-203) and replace its body's state-setting so the plan section can render read-only. Replace:

```ts
      setSubscription(data.subscription ?? null);
      setPlans(data.plans ?? []);
```

with:

```ts
      setSubscription(data.subscription ?? null);
      setPlans(data.plans ?? []);
      setBillingManagedElsewhere(Boolean(data.managedElsewhere));
```

Add the state declaration next to the other billing state (near line 124, after `const [billingPlan, setBillingPlan] = useState<string | null>(null);`):

```ts
  const [billingManagedElsewhere, setBillingManagedElsewhere] = useState(false);
```

Then in the `Plan` `<s-section>` (near line 684), immediately inside the section's `<s-stack>`, add a guard banner and gate the plan buttons. Replace the opening of the subscription conditional:

```tsx
          <s-stack direction="block" gap="base">
            {subscription ? (
```

with:

```tsx
          <s-stack direction="block" gap="base">
            {billingManagedElsewhere ? (
              <s-banner tone="info">
                <s-text>
                  Your plan is billed by card and managed in Asmos. To change or cancel it, open Asmos on the web.
                </s-text>
              </s-banner>
            ) : subscription ? (
```

The rest of the branch (the existing `subscription` and free-plan rendering) is unchanged; this just adds the read-only case first.

- [ ] **Step 3: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/shopify/admin/billing/route.ts apps/web/src/app/shopify-admin/page.tsx
git commit -m "fix: block Shopify charge when Stripe actively owns the account"
```

---

### Task A6: Guard the Stripe checkout endpoint and set `billingSource` on Stripe events

**Files:**
- Modify: `apps/web/src/app/api/billing/checkout/route.ts`
- Modify: `apps/web/src/app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Guard Stripe checkout against an active Shopify rail**

In `apps/web/src/app/api/billing/checkout/route.ts`, add the import at the top:

```ts
import { canStartStripeCheckout } from "@/lib/billing/source";
```

Then, immediately after `const account = await getOrCreateAccount();` (line 29), insert:

```ts
    // One rail per account: refuse card checkout while Shopify actively bills
    // this merchant. They must change their plan from the Shopify admin.
    if (!canStartStripeCheckout(account)) {
      return NextResponse.json(
        {
          error:
            "Your plan is billed through Shopify. Open your Shopify admin to change or cancel it.",
        },
        { status: 409 },
      );
    }
```

- [ ] **Step 2: Set `billingSource` on Stripe subscription webhooks**

In `apps/web/src/app/api/webhooks/stripe/route.ts`, in the `customer.subscription.created`/`customer.subscription.updated` case, replace the `updateMany` data block (near lines 89-95):

```ts
        await prisma.account.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            subscriptionStatus: mappedStatus,
            ...(mappedTier && { planTier: mappedTier }), // Only update tier if we successfully mapped it
          },
        });
```

with:

```ts
        // An active/trialing/past_due Stripe sub makes Stripe the owning rail;
        // a terminal status relinquishes ownership so the merchant could later
        // be billed via Shopify without a stale STRIPE flag blocking them.
        const stripeOwns =
          mappedStatus === "ACTIVE" || mappedStatus === "TRIALING" || mappedStatus === "PAST_DUE";
        await prisma.account.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            subscriptionStatus: mappedStatus,
            ...(mappedTier && { planTier: mappedTier }),
            billingSource: stripeOwns ? "STRIPE" : "NONE",
          },
        });
```

Then in the `customer.subscription.deleted` case, replace its data block (near lines 104-110):

```ts
        await prisma.account.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            subscriptionStatus: "CANCELED",
            planTier: "FREE",
          },
        });
```

with:

```ts
        await prisma.account.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            subscriptionStatus: "CANCELED",
            planTier: "FREE",
            billingSource: "NONE",
          },
        });
```

- [ ] **Step 3: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/billing/checkout/route.ts apps/web/src/app/api/webhooks/stripe/route.ts
git commit -m "feat: mark Stripe as the owning billing rail and block cross-rail checkout"
```

---

### Task A7: Fix the settings `isShopify` computation

**Files:**
- Modify: `apps/web/src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Base `isShopify` on the billing rail, not shop presence**

In `apps/web/src/app/(dashboard)/settings/page.tsx`, replace line 46:

```ts
  const isShopify = await prisma.shopifyShop.count({ where: { accountId: account.id } }) > 0;
```

with:

```ts
  // Show the read-only "managed by Shopify" state ONLY when Shopify is the
  // active billing rail — NOT merely because a store is connected. A web-first
  // merchant who paid by card and later connected Shopify keeps full Stripe
  // controls here (their rail is STRIPE, not SHOPIFY).
  const isShopify = account.billingSource === "SHOPIFY";
```

- [ ] **Step 2: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors. (If `account` isn't already selected with `billingSource`, confirm `getOrCreateAccount()` returns the full row — it does; it returns the Account model which now includes `billingSource`.)

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(dashboard)/settings/page.tsx"
git commit -m "fix: settings billing controls key off billingSource not shop presence"
```

- [ ] **Step 4: Run the full Part A test + type suite**

Run: `cd apps/web && npx vitest run src/lib/billing src/lib/shopify/billingSync.test.ts && npx tsc --noEmit`
Expected: all green, no type errors. **Part A is now shippable.**

---

# PART B — Seamless SSO handoff (no login wall)

### Task B1: One-time SSO handoff token

**Files:**
- Create: `apps/web/src/lib/shopify/ssoToken.ts`
- Test: `apps/web/src/lib/shopify/ssoToken.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/shopify/ssoToken.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Reuse the real AES-GCM box; it needs a key in env.
beforeEach(() => {
  process.env.INTEGRATION_ENCRYPTION_KEY =
    process.env.INTEGRATION_ENCRYPTION_KEY ??
    "0".repeat(64); // 32 bytes hex — matches lib/crypto expectations
});

import { createSsoToken, verifySsoToken, InvalidSsoTokenError } from "./ssoToken";

describe("ssoToken", () => {
  it("round-trips shopDomain + accountId", () => {
    const t = createSsoToken("s.myshopify.com", "acc_1");
    expect(verifySsoToken(t)).toEqual({ shopDomain: "s.myshopify.com", accountId: "acc_1" });
  });

  it("rejects a tampered token", () => {
    const t = createSsoToken("s.myshopify.com", "acc_1");
    expect(() => verifySsoToken(t.slice(0, -2) + "xy")).toThrow(InvalidSsoTokenError);
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    const t = createSsoToken("s.myshopify.com", "acc_1");
    vi.advanceTimersByTime(3 * 60 * 1000); // TTL is 2 min
    expect(() => verifySsoToken(t)).toThrow(InvalidSsoTokenError);
    vi.useRealTimers();
  });
});
```

> If `src/lib/crypto.ts` reads a different env var name for its key, set that name in `beforeEach` instead — check the top of `crypto.ts` and match it. The test asserts behavior, not the key name.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/shopify/ssoToken.test.ts`
Expected: FAIL — `Cannot find module './ssoToken'`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/lib/shopify/ssoToken.ts`:

```ts
import { encryptSecret, decryptSecret } from "@/lib/crypto";

// A short-lived, tamper-proof token that grants a first-party web session AS a
// shop's Asmos account — the seamless handoff that lets an embedded merchant
// open the full Asmos dashboard (builder, integrations) without hitting a Clerk
// login wall. Minted server-side ONLY after verifying the App Bridge session
// token (so it can't be forged for another shop), carried in the top-frame URL,
// and exchanged by /api/shopify/sso for the first-party session cookie.
//
// Distinct from linkToken.ts: linkToken proves shop control so a merchant can
// MERGE the shop into a *different* existing Clerk account; ssoToken simply
// re-establishes a web session for the shop's OWN account. Built on the same
// AES-256-GCM box (integrity + confidentiality, no separate HMAC needed).

const TTL_MS = 2 * 60 * 1000; // 2 minutes — one navigation's worth.

interface SsoTokenPayload {
  shopDomain: string;
  accountId: string;
  exp: number; // epoch ms
}

export function createSsoToken(shopDomain: string, accountId: string): string {
  const payload: SsoTokenPayload = { shopDomain, accountId, exp: Date.now() + TTL_MS };
  return encryptSecret(JSON.stringify(payload));
}

export class InvalidSsoTokenError extends Error {}

export function verifySsoToken(token: string): { shopDomain: string; accountId: string } {
  let payload: SsoTokenPayload;
  try {
    payload = JSON.parse(decryptSecret(token)) as SsoTokenPayload;
  } catch {
    throw new InvalidSsoTokenError("This handoff link is invalid.");
  }
  if (!payload.shopDomain || !payload.accountId || typeof payload.exp !== "number") {
    throw new InvalidSsoTokenError("This handoff link is invalid.");
  }
  if (Date.now() > payload.exp) {
    throw new InvalidSsoTokenError("This handoff link has expired. Please try again from the app.");
  }
  return { shopDomain: payload.shopDomain, accountId: payload.accountId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/shopify/ssoToken.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/shopify/ssoToken.ts apps/web/src/lib/shopify/ssoToken.test.ts
git commit -m "feat: add one-time SSO handoff token"
```

---

### Task B2: First-party shop session cookie setter

**Files:**
- Modify: `apps/web/src/lib/shopify/session-cookie.ts`

- [ ] **Step 1: Add the first-party setter**

In `apps/web/src/lib/shopify/session-cookie.ts`, after `setShopSessionCookie` (ends line 82), add:

```ts
// First-party variant used by the SSO handoff (/api/shopify/sso). The embedded
// cookie set by setShopSessionCookie is SameSite=None + Partitioned (CHIPS),
// keyed to the Shopify-admin partition — so it is NOT sent when the merchant
// navigates top-frame to app.asmos.io. This sets the same signed value as a
// normal first-party cookie (SameSite=Lax, unpartitioned) so getOrCreateAccount
// resolves the shop's account on the web dashboard without a Clerk sign-in.
export async function setFirstPartyShopSessionCookie(session: ShopSession): Promise<void> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.set(COOKIE_NAME, encodeShopSession(session), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/shopify/session-cookie.ts
git commit -m "feat: add first-party shop session cookie setter for SSO handoff"
```

---

### Task B3: Handoff mint route

**Files:**
- Create: `apps/web/src/app/api/shopify/admin/handoff/route.ts`

- [ ] **Step 1: Write the route**

Create `apps/web/src/app/api/shopify/admin/handoff/route.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { verifySessionToken, InvalidSessionTokenError } from "@/lib/shopify/session";
import { createSsoToken } from "@/lib/shopify/ssoToken";

// POST /api/shopify/admin/handoff  { path?: string }
// Authed by the App Bridge session token (so only someone inside this shop's
// embedded admin can mint it). Returns a top-frame URL that, when opened, logs
// the merchant into the web dashboard as this shop's account and lands them on
// `path`. This is the "no Clerk login wall" bridge for the popup builder and
// any other web-only surface the embed links out to.
export async function POST(request: Request): Promise<Response> {
  let shopDomain: string;
  try {
    ({ shopDomain } = await verifySessionToken(request));
  } catch (err) {
    if (err instanceof InvalidSessionTokenError) {
      return Response.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  const shop = await prisma.shopifyShop.findUnique({
    where: { shopDomain },
    select: { accountId: true, uninstalledAt: true },
  });
  if (!shop || shop.uninstalledAt) {
    return Response.json({ error: "This store isn't installed." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { path?: string };
  const token = createSsoToken(shopDomain, shop.accountId);
  const appUrl = process.env.SHOPIFY_APP_URL || "https://app.asmos.io";
  const next = sanitizeNext(body.path);
  const url = `${appUrl}/api/shopify/sso?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;
  return Response.json({ url });
}

// Only allow app-internal, single-slash relative paths as the destination, so
// the handoff can never be coerced into an open redirect.
function sanitizeNext(path?: string): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/campaigns";
  return path;
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/shopify/admin/handoff/route.ts
git commit -m "feat: add SSO handoff mint route"
```

---

### Task B4: SSO exchange route

**Files:**
- Create: `apps/web/src/app/api/shopify/sso/route.ts`

- [ ] **Step 1: Write the route**

Create `apps/web/src/app/api/shopify/sso/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySsoToken, InvalidSsoTokenError } from "@/lib/shopify/ssoToken";
import { setFirstPartyShopSessionCookie } from "@/lib/shopify/session-cookie";

// GET /api/shopify/sso?token=…&next=/campaigns/new
// Top-frame landing for the handoff: verifies the one-time token, re-confirms
// the token's account still owns the installed shop, sets the first-party shop
// session cookie, then redirects to `next` on the app. Runs first-party on
// app.asmos.io (the merchant has broken out of the Shopify iframe), so the
// SameSite=Lax cookie sticks for subsequent dashboard requests.
export async function GET(request: Request): Promise<Response> {
  const appUrl = process.env.SHOPIFY_APP_URL || "https://app.asmos.io";
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") ?? "";
  const nextRaw = searchParams.get("next") ?? "/campaigns";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/campaigns";

  let shopDomain: string;
  let accountId: string;
  try {
    ({ shopDomain, accountId } = verifySsoToken(token));
  } catch (err) {
    if (err instanceof InvalidSsoTokenError) {
      // Fall back to normal sign-in rather than 500 on a stale/forged link.
      return NextResponse.redirect(new URL("/sign-in", appUrl), 302);
    }
    throw err;
  }

  // Re-verify ownership at exchange time: the shop could have uninstalled or
  // been re-linked to a different account since the token was minted.
  const shop = await prisma.shopifyShop.findUnique({
    where: { shopDomain },
    select: { accountId: true, uninstalledAt: true },
  });
  if (!shop || shop.uninstalledAt || shop.accountId !== accountId) {
    return NextResponse.redirect(new URL("/sign-in", appUrl), 302);
  }

  await setFirstPartyShopSessionCookie({ shopDomain, accountId });
  return NextResponse.redirect(new URL(next, appUrl), 302);
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual verification note**

Add to the PR description: verify in staging that opening the minted `/api/shopify/sso?...` URL top-frame from the embed lands on `/campaigns/new` **already authenticated as the shop's account** (no Clerk sign-in), and that a merchant who never created a Clerk account can build a popup. Confirm a tampered/expired token redirects to `/sign-in`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/shopify/sso/route.ts
git commit -m "feat: add SSO exchange route establishing first-party web session"
```

---

### Task B5: Route the embed's dashboard links through the handoff

**Files:**
- Modify: `apps/web/src/app/shopify-admin/page.tsx`

- [ ] **Step 1: Add a shared handoff opener and use it for the builder**

In `apps/web/src/app/shopify-admin/page.tsx`, replace the `openAsmosBuilder` function (near lines 347-349):

```ts
  function openAsmosBuilder() {
    window.open(`${window.location.origin}/campaigns/new`, "_top");
  }
```

with:

```ts
  // Open a web-dashboard path in the TOP frame, authenticated as this shop's
  // account via the SSO handoff — no Clerk login wall for a Shopify-first
  // merchant. Falls back to a plain top-frame open if minting fails.
  async function openInAsmos(path: string) {
    try {
      const token = await window.shopify!.idToken();
      const res = await fetch("/api/shopify/admin/handoff", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.url) {
        window.open(data.url, "_top");
        return;
      }
      window.shopify?.toast?.show(data?.error ?? "Could not open Asmos", { isError: true });
    } catch (err) {
      window.shopify?.toast?.show((err as Error).message, { isError: true });
    }
  }

  function openAsmosBuilder() {
    void openInAsmos("/campaigns/new");
  }
```

- [ ] **Step 2: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors. (`openAsmosBuilder` keeps the same call sites; only its body changed.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/shopify-admin/page.tsx
git commit -m "feat: open Asmos builder from embed via authenticated SSO handoff"
```

**Part B is now shippable.**

---

# PART C — Link-merge data integrity

### Task C1: Guard the merge against double-billing and migrate campaigns

**Files:**
- Modify: `apps/web/src/lib/shopify/tenant.ts` (`linkShopToAccount`, near lines 171-239)
- Test: `apps/web/src/lib/shopify/tenant.link.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/shopify/tenant.link.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/crypto", () => ({
  encryptSecret: (s: string) => `enc(${s})`,
  decryptSecret: (s: string) => s.replace(/^enc\(|\)$/g, ""),
}));
vi.mock("./client", () => ({ shopify: {} }));
vi.mock("@/lib/prisma", () => {
  const prisma = {
    shopifyShop: { findUnique: vi.fn(), update: vi.fn() },
    account: { findUnique: vi.fn(), delete: vi.fn() },
    website: { create: vi.fn() },
    campaign: { updateMany: vi.fn() },
    user: { count: vi.fn() },
    lead: { count: vi.fn() },
    integrationConnection: { count: vi.fn() },
  };
  return { prisma };
});

import { prisma } from "@/lib/prisma";
import { linkShopToAccount, ShopLinkError } from "./tenant";

const p = prisma as any;

beforeEach(() => {
  Object.values(p).forEach((m: any) => Object.values(m).forEach((fn: any) => fn.mockReset?.()));
  p.website.create.mockResolvedValue({ id: "web_target" });
  p.shopifyShop.update.mockResolvedValue({});
  p.campaign.updateMany.mockResolvedValue({ count: 2 });
  p.user.count.mockResolvedValue(0);
  p.lead.count.mockResolvedValue(0);
  p.integrationConnection.count.mockResolvedValue(0);
});

describe("linkShopToAccount billing conflict", () => {
  it("refuses when the shop's account has an active Shopify sub and target is billed by Stripe", async () => {
    p.shopifyShop.findUnique.mockResolvedValue({
      id: "shop_1", accountId: "throwaway", uninstalledAt: null,
      account: { billingSource: "SHOPIFY", subscriptionStatus: "ACTIVE" },
    });
    p.account.findUnique.mockResolvedValue({
      id: "target", billingSource: "STRIPE", subscriptionStatus: "ACTIVE",
      shopifyShop: null, websites: [],
    });
    await expect(linkShopToAccount("s.myshopify.com", "target")).rejects.toBeInstanceOf(ShopLinkError);
    expect(p.shopifyShop.update).not.toHaveBeenCalled();
  });
});

describe("linkShopToAccount campaign migration", () => {
  it("migrates campaigns to the target account and does not delete a throwaway that still has integrations", async () => {
    p.shopifyShop.findUnique.mockResolvedValue({
      id: "shop_1", accountId: "throwaway", uninstalledAt: null,
      account: { billingSource: "NONE", subscriptionStatus: "TRIALING" },
    });
    p.account.findUnique.mockResolvedValue({
      id: "target", billingSource: "NONE", subscriptionStatus: "TRIALING",
      shopifyShop: null, websites: [{ id: "web_target", url: "s.myshopify.com" }],
    });
    p.integrationConnection.count.mockResolvedValue(1); // has a Klaviyo connection

    const res = await linkShopToAccount("s.myshopify.com", "target");

    expect(res.websiteId).toBe("web_target");
    // shop re-pointed
    expect(p.shopifyShop.update).toHaveBeenCalledWith({
      where: { id: "shop_1" },
      data: { accountId: "target", websiteId: "web_target", linkedAt: expect.any(Date) },
    });
    // campaigns migrated to target account + this shop's website
    expect(p.campaign.updateMany).toHaveBeenCalledWith({
      where: { accountId: "throwaway" },
      data: { accountId: "target", websiteId: "web_target" },
    });
    // throwaway kept (has integrations) — not deleted
    expect(p.account.delete).not.toHaveBeenCalled();
  });

  it("deletes an empty throwaway after migrating campaigns", async () => {
    p.shopifyShop.findUnique.mockResolvedValue({
      id: "shop_1", accountId: "throwaway", uninstalledAt: null,
      account: { billingSource: "NONE", subscriptionStatus: "TRIALING" },
    });
    p.account.findUnique.mockResolvedValue({
      id: "target", billingSource: "NONE", subscriptionStatus: "TRIALING",
      shopifyShop: null, websites: [{ id: "web_target", url: "s.myshopify.com" }],
    });
    p.account.delete.mockResolvedValue({});

    await linkShopToAccount("s.myshopify.com", "target");

    expect(p.campaign.updateMany).toHaveBeenCalled();
    expect(p.account.delete).toHaveBeenCalledWith({ where: { id: "throwaway" } });
  });
});
```

> If the Prisma model for integration connections is named differently than `integrationConnection`, adjust the mock key and the implementation call to match the actual delegate name (check `schema.prisma` — the relation on `Account` is `integrationConnections IntegrationConnection[]`, so the delegate is `prisma.integrationConnection`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/shopify/tenant.link.test.ts`
Expected: FAIL — the current `linkShopToAccount` neither reads `shop.account`/target billing nor calls `campaign.updateMany`, and it deletes based on `leadCount` only.

- [ ] **Step 3: Update `linkShopToAccount`**

In `apps/web/src/lib/shopify/tenant.ts`, add the import for the precedence helper at the top (after the existing imports, near line 3):

```ts
import { isRailActive } from "@/lib/billing/source";
```

Change the shop lookup at the start of `linkShopToAccount` (line 176) to include the account's billing fields:

```ts
  const shop = await prisma.shopifyShop.findUnique({
    where: { shopDomain },
    include: { account: { select: { billingSource: true, subscriptionStatus: true } } },
  });
```

Change the target lookup (lines 187-190) to also select the target's billing fields:

```ts
  const target = await prisma.account.findUnique({
    where: { id: targetAccountId },
    select: {
      id: true,
      billingSource: true,
      subscriptionStatus: true,
      shopifyShop: { select: { id: true } },
      websites: { select: { id: true, url: true } },
    },
  });
```

Immediately after the existing `if (target.shopifyShop && target.shopifyShop.id !== shop.id)` guard (ends line 195), insert the billing-conflict guard:

```ts
  // Double-billing guard: if the shop's current account is actively billed by
  // Shopify AND the target account is actively billed by Stripe, merging would
  // leave the merchant paying on both rails. Refuse and tell them how to fix it.
  const shopRailActive =
    shop.account &&
    isRailActive({
      billingSource: shop.account.billingSource,
      planTier: "FREE",
      subscriptionStatus: shop.account.subscriptionStatus,
    });
  const targetRailActive = isRailActive({
    billingSource: target.billingSource,
    planTier: "FREE",
    subscriptionStatus: target.subscriptionStatus,
  });
  if (
    shop.account?.billingSource === "SHOPIFY" &&
    shopRailActive &&
    target.billingSource === "STRIPE" &&
    targetRailActive
  ) {
    throw new ShopLinkError(
      "This store has an active Shopify subscription and the Asmos account you're connecting to is billed by card. Cancel the Shopify subscription first so you aren't charged twice.",
    );
  }
```

Then replace the "re-point + cleanup" block (lines 213-236) with the migration-aware version:

```ts
  const oldAccountId = shop.accountId;

  // 1) Re-point the shop (and its storefront website mapping).
  await prisma.shopifyShop.update({
    where: { id: shop.id },
    data: { accountId: targetAccountId, websiteId, linkedAt: new Date() },
  });

  // 2) Migrate any campaigns the merchant built while the shop was on its old
  //    (throwaway) account onto the target account + this shop's website, so
  //    linking never orphans or cascade-deletes their popups. Leads follow their
  //    campaigns (Lead -> Variant -> Campaign), so this moves lead/revenue data
  //    with them.
  if (oldAccountId !== targetAccountId) {
    await prisma.campaign.updateMany({
      where: { accountId: oldAccountId },
      data: { accountId: targetAccountId, websiteId },
    });
  }

  // 3) Delete the orphaned throwaway account — only when it holds nothing worth
  //    keeping. Campaigns/leads have moved; block deletion if it still has Clerk
  //    users or integration connections (a Shopify-first merchant can now reach
  //    the dashboard via SSO and connect integrations under the throwaway).
  if (oldAccountId !== targetAccountId) {
    const [userCount, connCount] = await Promise.all([
      prisma.user.count({ where: { accountId: oldAccountId } }),
      prisma.integrationConnection.count({ where: { accountId: oldAccountId } }),
    ]);
    if (userCount === 0 && connCount === 0) {
      await prisma.account.delete({ where: { id: oldAccountId } }).catch((err) => {
        console.error("[shopify/link] throwaway account delete failed", oldAccountId, err);
      });
    } else {
      console.warn(
        `[shopify/link] kept old account ${oldAccountId} (users=${userCount}, connections=${connCount}) after linking ${shopDomain}`,
      );
    }
  }

  return { websiteId };
```

> This removes the old `lead.count` check (leads now migrate with campaigns, so counting them no longer makes sense as a delete gate). The `prisma.lead` import/usage elsewhere in the file is unaffected.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/shopify/tenant.link.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/shopify/tenant.ts apps/web/src/lib/shopify/tenant.link.test.ts
git commit -m "fix: migrate campaigns and block double-billing on shop link"
```

**Part C is now shippable.**

---

## Final Verification (run after all parts)

- [ ] **Full test suite**

Run: `cd apps/web && npx vitest run`
Expected: all tests pass (existing 108 + the new billing/sso/link suites).

- [ ] **Type + lint**

Run: `cd apps/web && npx tsc --noEmit && npx eslint src/lib/billing src/lib/shopify src/app/api/shopify src/app/api/billing`
Expected: clean.

- [ ] **Deploy checklist (note in PR, not code):**
  - `prisma migrate deploy` applies `add_billing_source` to the prod DB.
  - `shopify app deploy` registers the `app_subscriptions/update` webhook subscription.
  - `INTEGRATION_ENCRYPTION_KEY` present (SSO token reuses the AES box — already required by integrations).
  - Confirm `SHOPIFY_APP_URL` is set in prod (defaults to `https://app.asmos.io`).

---

## Edge-case coverage matrix (self-review)

| Scenario | Handled by | Result |
|---|---|---|
| Shopify-first, uses only the embed | A3/A4 | Shopify sub webhook writes `planTier`/`billingSource=SHOPIFY`; entitlements correct. |
| Shopify-first opens the web builder | B1–B5 | SSO handoff → authenticated as shop's account, no Clerk wall. |
| Web-first (Stripe) connects Shopify | A5/A7 | Embed billing read-only (`managedElsewhere`); settings keeps Stripe controls. |
| Web-first (FREE) subscribes via Shopify | A4/A6 | `billingSource` flips to SHOPIFY; later Stripe checkout blocked (A6). |
| Both rails somehow attempted | A5/A6 | Whichever rail is active blocks the other at creation (409). |
| Shopify sub cancelled / app uninstalled | A3/A4 | Downgrade to `NONE`/`FREE` via webhook + defensive uninstall handler. |
| Shopify-first (paid via Shopify) links to a Stripe web account | C1 | Refused with a clear "cancel Shopify sub first" message — no double bill. |
| Shopify-first (free) links to a web account after building popups | C1 | Campaigns + leads migrate to the target account; throwaway deleted only if empty. |
| Stranger types someone else's store domain | (existing) `POST /api/integrations/shopify` | Requires Shopify OAuth re-auth. |
| Stale/forged SSO token | B1/B4 | Rejected → redirect to `/sign-in`. |
| Third-party cookies blocked in the embed | (existing) session-token fallback + B (SSO sets first-party cookie) | Embed uses Bearer token; handoff sets a first-party cookie unaffected by ITP. |

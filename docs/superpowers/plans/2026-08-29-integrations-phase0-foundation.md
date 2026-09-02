# Integrations Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reliable, adapter-based integration event bus and migrate the existing Webhooks integration onto it, with no merchant-visible behaviour change except added delivery reliability and a delivery log.

**Architecture:** Domain events (`lead.captured`, `variant.winner_declared`) are emitted through a single `emitIntegrationEvent(accountId, event)` that loads the account's enabled `IntegrationConnection` rows subscribed to that event and enqueues one Inngest `integration/deliver` job per connection. The Inngest function resolves a provider **adapter** from a registry, calls `adapter.deliver()`, and writes an `IntegrationDelivery` audit row. Secrets are encrypted at rest (AES-256-GCM). Phase 0 ships exactly one adapter — `webhooks` — replacing today's fire-and-forget `dispatchWebhook`.

**Tech Stack:** Next.js 16 (custom fork — see `apps/web/AGENTS.md`), Prisma 7 + Postgres (pg adapter), Inngest 4, Node `crypto`, Vitest (added here). Package manager: **npm**. All commands run from `apps/web/`.

**Spec:** `docs/superpowers/specs/2026-08-28-integrations-automation-design.md`

> **Codebase caveat:** `apps/web/AGENTS.md` warns this Next.js is a modified fork — when editing route handlers (Tasks 11–12), do not assume App Router signatures from memory; open the existing sibling route files (already cited) and match their exact shape. The lib/crypto/adapter/Inngest modules are framework-independent and unaffected.

---

## File Structure

**New files**
- `apps/web/vitest.config.ts` — Vitest config with `@/` alias.
- `apps/web/src/lib/integrations/crypto.ts` — AES-256-GCM encrypt/decrypt of secret bundles.
- `apps/web/src/lib/integrations/crypto.test.ts`
- `apps/web/src/lib/integrations/types.ts` — provider enum guard, event union, adapter interface, result types.
- `apps/web/src/lib/integrations/types.test.ts`
- `apps/web/src/lib/integrations/adapters/webhookAdapter.ts` — the `webhooks` adapter (build + sign + POST).
- `apps/web/src/lib/integrations/adapters/webhookAdapter.test.ts`
- `apps/web/src/lib/integrations/registry.ts` — provider → adapter map + `getAdapter`.
- `apps/web/src/lib/integrations/registry.test.ts`
- `apps/web/src/lib/integrations/connections.ts` — data access: encrypt-on-write, mask/decrypt-on-read, delivery loader, delivery recorder.
- `apps/web/src/lib/integrations/connections.test.ts`
- `apps/web/src/lib/integrations/emit.ts` — `emitIntegrationEvent`.
- `apps/web/src/lib/integrations/emit.test.ts`
- `apps/web/src/lib/inngest/deliverIntegration.ts` — Inngest `integration-deliver` function.
- `apps/web/src/lib/inngest/deliverIntegration.test.ts`
- `apps/web/src/lib/inngest/pruneIntegrationDeliveries.ts` — cron prune.
- `apps/web/scripts/backfill-integration-connections.ts` — one-time migration of existing webhook + `integrationCredentials` data.

**Modified files**
- `apps/web/package.json` — add vitest dev dep + `test` scripts.
- `apps/web/prisma/schema.prisma` — add enum + 2 models + Account relation.
- `apps/web/src/lib/inngest/functions.ts` — register the 2 new functions.
- `apps/web/src/app/api/account/webhook/route.ts` — persist via `IntegrationConnection` instead of `Account.webhook*` columns.
- `apps/web/src/app/api/widget/leads/route.ts:175-201` — emit via `emitIntegrationEvent`.
- `apps/web/src/app/api/campaigns/[id]/route.ts:118-139` — emit via `emitIntegrationEvent`.

**Not in Phase 0 (later phases):** the other 10 adapters, the redesigned Integrations UI with per-event toggles, `gift.claimed` emission, `MessageTemplate`/`rules`, and consent gating (introduced with the first lead-directed adapter in Phase 2). `dispatchWebhook`'s payload **types** in `lib/webhook.ts` are reused; its dispatch **function** becomes dead after Task 12 and is deleted there.

---

## Task 1: Set up Vitest

**Files:**
- Create: `apps/web/vitest.config.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install Vitest**

Run (from `apps/web/`):
```bash
npm install -D vitest@^3
```
Expected: adds `vitest` to `devDependencies`, updates `package-lock.json`.

- [ ] **Step 2: Add test scripts to `package.json`**

In `apps/web/package.json`, add to `"scripts"`:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
```

- [ ] **Step 4: Add a smoke test to prove the runner works**

Create `apps/web/src/lib/integrations/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("vitest", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: PASS, 1 test.

- [ ] **Step 6: Delete the smoke test and commit**

```bash
rm src/lib/integrations/smoke.test.ts
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest test runner"
```

---

## Task 2: Credential encryption (`crypto.ts`)

**Files:**
- Create: `apps/web/src/lib/integrations/crypto.ts`
- Test: `apps/web/src/lib/integrations/crypto.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// crypto.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { encryptSecret, decryptSecret, type EncryptedSecret } from "./crypto";

const KEY_HEX = "0".repeat(64); // 32 bytes of zero, hex

describe("integration crypto", () => {
  beforeEach(() => {
    process.env.INTEGRATION_ENCRYPTION_KEY = KEY_HEX;
  });

  it("round-trips a secret", () => {
    const enc = encryptSecret("hunter2");
    expect(enc.v).toBe(1);
    expect(enc.data).not.toContain("hunter2");
    expect(decryptSecret(enc)).toBe("hunter2");
  });

  it("produces a different IV each call", () => {
    const a = encryptSecret("same");
    const b = encryptSecret("same");
    expect(a.iv).not.toEqual(b.iv);
  });

  it("rejects tampered ciphertext (auth tag)", () => {
    const enc = encryptSecret("hunter2");
    const tampered: EncryptedSecret = { ...enc, data: enc.data.replace(/.$/, (c) => (c === "a" ? "b" : "a")) };
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("throws when the key is missing", () => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    expect(() => encryptSecret("x")).toThrow(/INTEGRATION_ENCRYPTION_KEY/);
  });

  it("throws when the key is the wrong length", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = "abcd";
    expect(() => encryptSecret("x")).toThrow(/32 bytes/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- crypto`
Expected: FAIL — cannot find module `./crypto`.

- [ ] **Step 3: Implement `crypto.ts`**

```ts
import crypto from "crypto";

const ALGO = "aes-256-gcm";

export interface EncryptedSecret {
  v: 1;
  iv: string; // hex
  tag: string; // hex
  data: string; // hex ciphertext
}

function getKey(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  }
  return key;
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    v: 1,
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
    data: enc.toString("hex"),
  };
}

export function decryptSecret(payload: EncryptedSecret): string {
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(payload.iv, "hex"));
  decipher.setAuthTag(Buffer.from(payload.tag, "hex"));
  const dec = Buffer.concat([decipher.update(Buffer.from(payload.data, "hex")), decipher.final()]);
  return dec.toString("utf8");
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- crypto`
Expected: PASS, 5 tests.

- [ ] **Step 5: Document the env var**

Add to `apps/web/.env.example` (create if absent):
```
# 32-byte key as 64 hex chars, e.g. `openssl rand -hex 32`. Encrypts integration credentials at rest.
INTEGRATION_ENCRYPTION_KEY=
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/integrations/crypto.ts src/lib/integrations/crypto.test.ts .env.example
git commit -m "feat: AES-256-GCM credential encryption for integrations"
```

---

## Task 3: Prisma models + migration

**Files:**
- Modify: `apps/web/prisma/schema.prisma`

- [ ] **Step 1: Add the enum and models**

Append to `apps/web/prisma/schema.prisma`:
```prisma
enum IntegrationProvider {
  webhooks
  zapier
  make
  n8n
  slack
  discord
  teams
  klaviyo
  mailchimp
  hubspot
  mailgun
  twilio
}

model IntegrationConnection {
  id        String   @id @default(cuid())
  accountId String
  account   Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)

  provider IntegrationProvider
  enabled  Boolean  @default(true)

  // Non-secret config: endpoint URL, list id, from-address, etc.
  config Json @default("{}")

  // AES-256-GCM EncryptedSecret whose plaintext is a JSON secret bundle.
  // Never returned to the client in plaintext.
  credentials Json?

  // Which canonical events fire this connection (e.g. ["lead.captured"]).
  subscribedEvents String[] @default([])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  deliveries IntegrationDelivery[]

  @@index([accountId, provider])
}

model IntegrationDelivery {
  id           String                @id @default(cuid())
  connectionId String
  connection   IntegrationConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)

  event  String
  status String // "success" | "failed" | "skipped"
  detail String? @db.Text

  createdAt DateTime @default(now())

  @@index([connectionId, createdAt])
}
```

- [ ] **Step 2: Add the back-relation to `Account`**

In the `Account` model (`apps/web/prisma/schema.prisma`, around line 79), add alongside the other relation fields:
```prisma
  integrationConnections IntegrationConnection[]
```

- [ ] **Step 3: Hand-write the migration SQL (no database required)**

The repo's deploy pipeline (`.github/workflows/migrate.yml`) runs `prisma migrate deploy`
on push to `main`, which **applies** committed migration files — it does not need us to
generate them against a live DB. So author the migration file by hand, matching the exact
format Prisma emits (see `prisma/migrations/20260826010000_add_shopify_shop/migration.sql`).

Create `apps/web/prisma/migrations/20260829000000_add_integration_connections/migration.sql`:
```sql
-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('webhooks', 'zapier', 'make', 'n8n', 'slack', 'discord', 'teams', 'klaviyo', 'mailchimp', 'hubspot', 'mailgun', 'twilio');

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "credentials" JSONB,
    "subscribedEvents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationDelivery" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationConnection_accountId_provider_idx" ON "IntegrationConnection"("accountId", "provider");

-- CreateIndex
CREATE INDEX "IntegrationDelivery_connectionId_createdAt_idx" ON "IntegrationDelivery"("connectionId", "createdAt");

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationDelivery" ADD CONSTRAINT "IntegrationDelivery_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

The SQL must exactly match the models added in Steps 1–2 (column names, types, the
`config`/`subscribedEvents` defaults, and the FK cascade). `migrate deploy` records the
migration by folder name and computes its checksum at apply time — a hand-authored file is
applied identically to a generated one.

- [ ] **Step 4: Regenerate the Prisma client (no DB needed) and typecheck**

Run (from `apps/web/`):
```bash
npx prisma generate && npx tsc --noEmit
```
Expected: client regenerates with `IntegrationConnection` / `IntegrationDelivery`; no type
errors. (`prisma generate` reads `schema.prisma` only — it does not connect to a database.
If a dev/shadow DB is ever available, `npx prisma migrate dev` will report "in sync",
confirming the hand-written SQL matches the schema.)

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: IntegrationConnection + IntegrationDelivery models"
```

---

## Task 4: Shared types (`types.ts`)

**Files:**
- Create: `apps/web/src/lib/integrations/types.ts`
- Test: `apps/web/src/lib/integrations/types.test.ts`

Reuses the event payload shapes already defined in `apps/web/src/lib/webhook.ts` (`LeadCapturedPayload`, `VariantWinnerPayload`).

- [ ] **Step 1: Write the failing test**

```ts
// types.test.ts
import { describe, it, expect } from "vitest";
import { isIntegrationProvider } from "./types";

describe("isIntegrationProvider", () => {
  it("accepts known providers", () => {
    expect(isIntegrationProvider("webhooks")).toBe(true);
    expect(isIntegrationProvider("slack")).toBe(true);
  });
  it("rejects unknown values", () => {
    expect(isIntegrationProvider("myspace")).toBe(false);
    expect(isIntegrationProvider(42)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- types`
Expected: FAIL — cannot find module `./types`.

- [ ] **Step 3: Implement `types.ts`**

```ts
import type { LeadCapturedPayload, VariantWinnerPayload } from "@/lib/webhook";

export const INTEGRATION_PROVIDERS = [
  "webhooks", "zapier", "make", "n8n", "slack", "discord", "teams",
  "klaviyo", "mailchimp", "hubspot", "mailgun", "twilio",
] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export function isIntegrationProvider(v: unknown): v is IntegrationProvider {
  return typeof v === "string" && (INTEGRATION_PROVIDERS as readonly string[]).includes(v);
}

// Canonical event union carried through the bus. Payload types are shared with
// the legacy webhook module to avoid duplication.
export type IntegrationEvent =
  | { event: "lead.captured"; payload: LeadCapturedPayload }
  | { event: "variant.winner_declared"; payload: VariantWinnerPayload };

export type IntegrationEventName = IntegrationEvent["event"];

// Decrypted, ready-to-use connection as seen by an adapter (server-side only).
export interface ResolvedConnection {
  id: string;
  accountId: string;
  provider: IntegrationProvider;
  enabled: boolean;
  config: Record<string, unknown>;
  subscribedEvents: string[];
  secrets: Record<string, string>;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export interface DeliveryResult {
  status: "success" | "failed" | "skipped";
  detail?: string;
  // When status is "failed", whether the pipeline should retry (network/5xx/429)
  // vs. give up (auth/validation). Ignored for success/skipped.
  retriable?: boolean;
}

export interface DeliverContext {
  event: IntegrationEvent;
  connection: ResolvedConnection;
}

export interface IntegrationAdapter {
  provider: IntegrationProvider;
  kind: "webhook" | "sync" | "messaging";
  validate(input: { config: Record<string, unknown>; secrets: Record<string, string> }): Promise<ValidationResult>;
  deliver(ctx: DeliverContext): Promise<DeliveryResult>;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- types`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/integrations/types.ts src/lib/integrations/types.test.ts
git commit -m "feat: integration adapter interface and event types"
```

---

## Task 5: Webhook adapter (`webhookAdapter.ts`)

**Files:**
- Create: `apps/web/src/lib/integrations/adapters/webhookAdapter.ts`
- Test: `apps/web/src/lib/integrations/adapters/webhookAdapter.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// webhookAdapter.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { webhookAdapter } from "./webhookAdapter";
import type { ResolvedConnection, IntegrationEvent } from "../types";

const conn: ResolvedConnection = {
  id: "c1", accountId: "a1", provider: "webhooks", enabled: true,
  config: { url: "https://example.com/hook" },
  subscribedEvents: ["lead.captured"],
  secrets: { signingSecret: "shh" },
};

const event: IntegrationEvent = {
  event: "lead.captured",
  payload: {
    campaign_id: "camp1", campaign_name: "Summer", variant_id: "v1", variant_name: "A",
    lead: { email: "j@x.com", name: "J", phone: null, consent_given: true, captured_at: "2026-08-29T00:00:00.000Z" },
    reward: null,
  },
};

describe("webhookAdapter", () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("POSTs a signed payload and returns success on 2xx", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const res = await webhookAdapter.deliver({ event, connection: conn });

    expect(res.status).toBe("success");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.com/hook");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-Asmos-Event"]).toBe("lead.captured");
    expect(headers["X-Asmos-Signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it("omits the signature header when no secret is set", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    const res = await webhookAdapter.deliver({ event, connection: { ...conn, secrets: {} } });
    expect(res.status).toBe("success");
  });

  it("returns retriable failure on 500", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));
    const res = await webhookAdapter.deliver({ event, connection: conn });
    expect(res.status).toBe("failed");
    expect(res.retriable).toBe(true);
  });

  it("returns non-retriable failure on 400", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 400 }));
    const res = await webhookAdapter.deliver({ event, connection: conn });
    expect(res.status).toBe("failed");
    expect(res.retriable).toBe(false);
  });

  it("returns retriable failure on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNRESET"));
    const res = await webhookAdapter.deliver({ event, connection: conn });
    expect(res.status).toBe("failed");
    expect(res.retriable).toBe(true);
  });

  it("validate rejects a non-https url", async () => {
    const res = await webhookAdapter.validate({ config: { url: "http://x.com" }, secrets: {} });
    expect(res.ok).toBe(false);
  });

  it("validate accepts an https url", async () => {
    const res = await webhookAdapter.validate({ config: { url: "https://x.com/h" }, secrets: {} });
    expect(res.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- webhookAdapter`
Expected: FAIL — cannot find module `./webhookAdapter`.

- [ ] **Step 3: Implement `webhookAdapter.ts`**

```ts
import crypto from "crypto";
import type { IntegrationAdapter, DeliveryResult, ValidationResult } from "../types";

function classify(status: number): DeliveryResult {
  if (status >= 200 && status < 300) return { status: "success" };
  // 408/429 and 5xx are transient; other 4xx are the merchant's endpoint rejecting us.
  const retriable = status === 408 || status === 429 || status >= 500;
  return { status: "failed", detail: `HTTP ${status}`, retriable };
}

export const webhookAdapter: IntegrationAdapter = {
  provider: "webhooks",
  kind: "webhook",

  async validate({ config }): Promise<ValidationResult> {
    const url = typeof config.url === "string" ? config.url : "";
    if (!url.startsWith("https://")) {
      return { ok: false, error: "Endpoint URL must start with https://" };
    }
    return { ok: true };
  },

  async deliver({ event, connection }): Promise<DeliveryResult> {
    const url = String(connection.config.url ?? "");
    const secret = connection.secrets.signingSecret ?? null;
    const payload = JSON.stringify(event);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Asmos-Webhook/1.0",
      "X-Asmos-Event": event.event,
      "X-Asmos-Timestamp": String(Date.now()),
    };
    if (secret) {
      const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      headers["X-Asmos-Signature"] = `sha256=${sig}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, { method: "POST", headers, body: payload, signal: controller.signal });
      return classify(res.status);
    } catch (err) {
      return { status: "failed", detail: err instanceof Error ? err.message : "network error", retriable: true };
    } finally {
      clearTimeout(timeout);
    }
  },
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- webhookAdapter`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/integrations/adapters/webhookAdapter.ts src/lib/integrations/adapters/webhookAdapter.test.ts
git commit -m "feat: webhooks integration adapter"
```

---

## Task 6: Adapter registry (`registry.ts`)

**Files:**
- Create: `apps/web/src/lib/integrations/registry.ts`
- Test: `apps/web/src/lib/integrations/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// registry.test.ts
import { describe, it, expect } from "vitest";
import { getAdapter } from "./registry";

describe("adapter registry", () => {
  it("resolves the webhooks adapter", () => {
    expect(getAdapter("webhooks")?.provider).toBe("webhooks");
  });
  it("returns undefined for a provider with no adapter yet", () => {
    expect(getAdapter("klaviyo")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- registry`
Expected: FAIL — cannot find module `./registry`.

- [ ] **Step 3: Implement `registry.ts`**

```ts
import type { IntegrationAdapter, IntegrationProvider } from "./types";
import { webhookAdapter } from "./adapters/webhookAdapter";

// Adapters implemented so far. Later phases add their entries here.
const ADAPTERS: Partial<Record<IntegrationProvider, IntegrationAdapter>> = {
  webhooks: webhookAdapter,
};

export function getAdapter(provider: IntegrationProvider): IntegrationAdapter | undefined {
  return ADAPTERS[provider];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- registry`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/integrations/registry.ts src/lib/integrations/registry.test.ts
git commit -m "feat: integration adapter registry"
```

---

## Task 7: Connection data access (`connections.ts`)

**Files:**
- Create: `apps/web/src/lib/integrations/connections.ts`
- Test: `apps/web/src/lib/integrations/connections.test.ts`

This module is the only place that encrypts/decrypts connection secrets. Prisma is mocked in tests.

- [ ] **Step 1: Write the failing tests**

```ts
// connections.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    integrationConnection: { upsert: vi.fn(), findUnique: vi.fn() },
    integrationDelivery: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { maskSecret, resolveConnection, recordDelivery } from "./connections";
import { encryptSecret } from "./crypto";

const KEY_HEX = "0".repeat(64);

describe("connections", () => {
  beforeEach(() => {
    process.env.INTEGRATION_ENCRYPTION_KEY = KEY_HEX;
    vi.clearAllMocks();
  });

  it("maskSecret shows only the last 4 chars", () => {
    expect(maskSecret("abcd1234efgh")).toBe("••••••••efgh");
    expect(maskSecret("")).toBeNull();
  });

  it("resolveConnection decrypts the secret bundle", async () => {
    const enc = encryptSecret(JSON.stringify({ signingSecret: "shh" }));
    (prisma.integrationConnection.findUnique as any).mockResolvedValue({
      id: "c1", accountId: "a1", provider: "webhooks", enabled: true,
      config: { url: "https://x.com" }, subscribedEvents: ["lead.captured"], credentials: enc,
    });

    const resolved = await resolveConnection("c1");
    expect(resolved?.secrets.signingSecret).toBe("shh");
    expect(resolved?.config.url).toBe("https://x.com");
  });

  it("resolveConnection returns null for a missing row", async () => {
    (prisma.integrationConnection.findUnique as any).mockResolvedValue(null);
    expect(await resolveConnection("nope")).toBeNull();
  });

  it("recordDelivery writes an audit row", async () => {
    await recordDelivery("c1", "lead.captured", { status: "success" });
    expect(prisma.integrationDelivery.create).toHaveBeenCalledWith({
      data: { connectionId: "c1", event: "lead.captured", status: "success", detail: undefined },
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- connections`
Expected: FAIL — cannot find module `./connections`.

- [ ] **Step 3: Implement `connections.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret, type EncryptedSecret } from "./crypto";
import { isIntegrationProvider, type ResolvedConnection, type DeliveryResult } from "./types";

export function maskSecret(secret: string): string | null {
  if (!secret) return null;
  return `••••••••${secret.slice(-4)}`;
}

export function encryptBundle(secrets: Record<string, string>): EncryptedSecret {
  return encryptSecret(JSON.stringify(secrets));
}

function decryptBundle(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  try {
    return JSON.parse(decryptSecret(raw as EncryptedSecret)) as Record<string, string>;
  } catch {
    return {};
  }
}

/** Server-side only: load a connection with its secrets decrypted, ready for an adapter. */
export async function resolveConnection(id: string): Promise<ResolvedConnection | null> {
  const row = await prisma.integrationConnection.findUnique({ where: { id } });
  if (!row || !isIntegrationProvider(row.provider)) return null;
  return {
    id: row.id,
    accountId: row.accountId,
    provider: row.provider,
    enabled: row.enabled,
    config: (row.config as Record<string, unknown>) ?? {},
    subscribedEvents: row.subscribedEvents ?? [],
    secrets: decryptBundle(row.credentials),
  };
}

export async function recordDelivery(connectionId: string, event: string, result: DeliveryResult): Promise<void> {
  await prisma.integrationDelivery.create({
    data: { connectionId, event, status: result.status, detail: result.detail },
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- connections`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/integrations/connections.ts src/lib/integrations/connections.test.ts
git commit -m "feat: integration connection data access with encrypted secrets"
```

---

## Task 8: Event emitter (`emit.ts`)

**Files:**
- Create: `apps/web/src/lib/integrations/emit.ts`
- Test: `apps/web/src/lib/integrations/emit.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// emit.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { integrationConnection: { findMany: vi.fn() } },
}));
vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: vi.fn() },
}));

import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import { emitIntegrationEvent } from "./emit";
import type { IntegrationEvent } from "./types";

const event: IntegrationEvent = {
  event: "lead.captured",
  payload: {
    campaign_id: "c", campaign_name: "n", variant_id: "v", variant_name: "A",
    lead: { email: "a@b.c", name: null, phone: null, consent_given: true, captured_at: "2026-08-29T00:00:00.000Z" },
    reward: null,
  },
};

describe("emitIntegrationEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("enqueues one inngest job per subscribed connection", async () => {
    (prisma.integrationConnection.findMany as any).mockResolvedValue([{ id: "c1" }, { id: "c2" }]);
    await emitIntegrationEvent("acct1", event);

    expect(prisma.integrationConnection.findMany).toHaveBeenCalledWith({
      where: { accountId: "acct1", enabled: true, subscribedEvents: { has: "lead.captured" } },
      select: { id: true },
    });
    expect(inngest.send).toHaveBeenCalledWith([
      { name: "integration/deliver", data: { connectionId: "c1", event } },
      { name: "integration/deliver", data: { connectionId: "c2", event } },
    ]);
  });

  it("does nothing when no connection is subscribed", async () => {
    (prisma.integrationConnection.findMany as any).mockResolvedValue([]);
    await emitIntegrationEvent("acct1", event);
    expect(inngest.send).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- emit`
Expected: FAIL — cannot find module `./emit`.

- [ ] **Step 3: Implement `emit.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import type { IntegrationEvent } from "./types";

/**
 * Fan a domain event out to every enabled connection subscribed to it.
 * Only enqueues Inngest jobs — never performs delivery inline, so it never
 * adds latency to the request that produced the event.
 */
export async function emitIntegrationEvent(accountId: string, event: IntegrationEvent): Promise<void> {
  const connections = await prisma.integrationConnection.findMany({
    where: { accountId, enabled: true, subscribedEvents: { has: event.event } },
    select: { id: true },
  });
  if (connections.length === 0) return;

  await inngest.send(
    connections.map((c) => ({ name: "integration/deliver", data: { connectionId: c.id, event } })),
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- emit`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/integrations/emit.ts src/lib/integrations/emit.test.ts
git commit -m "feat: emitIntegrationEvent fan-out"
```

---

## Task 9: Inngest delivery function (`deliverIntegration.ts`)

**Files:**
- Create: `apps/web/src/lib/inngest/deliverIntegration.ts`
- Test: `apps/web/src/lib/inngest/deliverIntegration.test.ts`

The handler logic is extracted into a plain, testable `runDelivery(connectionId, event)` so tests don't need the Inngest runtime; the Inngest function is a thin wrapper.

- [ ] **Step 1: Write the failing tests**

```ts
// deliverIntegration.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../integrations/connections", () => ({
  resolveConnection: vi.fn(),
  recordDelivery: vi.fn(),
}));
vi.mock("../integrations/registry", () => ({
  getAdapter: vi.fn(),
}));

import { resolveConnection, recordDelivery } from "../integrations/connections";
import { getAdapter } from "../integrations/registry";
import { runDelivery, RetriableDeliveryError } from "./deliverIntegration";
import type { IntegrationEvent } from "../integrations/types";

const event: IntegrationEvent = {
  event: "lead.captured",
  payload: {
    campaign_id: "c", campaign_name: "n", variant_id: "v", variant_name: "A",
    lead: { email: "a@b.c", name: null, phone: null, consent_given: true, captured_at: "2026-08-29T00:00:00.000Z" },
    reward: null,
  },
};
const resolved = {
  id: "c1", accountId: "a1", provider: "webhooks" as const, enabled: true,
  config: { url: "https://x.com" }, subscribedEvents: ["lead.captured"], secrets: {},
};

describe("runDelivery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips when the connection is missing", async () => {
    (resolveConnection as any).mockResolvedValue(null);
    const res = await runDelivery("c1", event);
    expect(res.status).toBe("skipped");
    expect(recordDelivery).toHaveBeenCalledWith("c1", "lead.captured", expect.objectContaining({ status: "skipped" }));
  });

  it("skips when the connection is disabled", async () => {
    (resolveConnection as any).mockResolvedValue({ ...resolved, enabled: false });
    const res = await runDelivery("c1", event);
    expect(res.status).toBe("skipped");
  });

  it("skips when no adapter exists", async () => {
    (resolveConnection as any).mockResolvedValue(resolved);
    (getAdapter as any).mockReturnValue(undefined);
    const res = await runDelivery("c1", event);
    expect(res.status).toBe("skipped");
  });

  it("delivers and logs success", async () => {
    (resolveConnection as any).mockResolvedValue(resolved);
    (getAdapter as any).mockReturnValue({ deliver: vi.fn().mockResolvedValue({ status: "success" }) });
    const res = await runDelivery("c1", event);
    expect(res.status).toBe("success");
    expect(recordDelivery).toHaveBeenCalledWith("c1", "lead.captured", { status: "success" });
  });

  it("logs a failed delivery then throws on retriable failure", async () => {
    (resolveConnection as any).mockResolvedValue(resolved);
    (getAdapter as any).mockReturnValue({ deliver: vi.fn().mockResolvedValue({ status: "failed", retriable: true, detail: "HTTP 500" }) });
    await expect(runDelivery("c1", event)).rejects.toBeInstanceOf(RetriableDeliveryError);
    expect(recordDelivery).toHaveBeenCalledWith("c1", "lead.captured", expect.objectContaining({ status: "failed" }));
  });

  it("logs a failed delivery and does NOT throw on non-retriable failure", async () => {
    (resolveConnection as any).mockResolvedValue(resolved);
    (getAdapter as any).mockReturnValue({ deliver: vi.fn().mockResolvedValue({ status: "failed", retriable: false, detail: "HTTP 400" }) });
    const res = await runDelivery("c1", event);
    expect(res.status).toBe("failed");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- deliverIntegration`
Expected: FAIL — cannot find module `./deliverIntegration`.

- [ ] **Step 3: Implement `deliverIntegration.ts`**

```ts
import { inngest } from "./client";
import { resolveConnection, recordDelivery } from "../integrations/connections";
import { getAdapter } from "../integrations/registry";
import type { DeliveryResult, IntegrationEvent } from "../integrations/types";

/** Thrown to signal Inngest that it should retry this delivery. */
export class RetriableDeliveryError extends Error {}

/**
 * Core delivery logic, runtime-independent so it can be unit-tested.
 * Always records an IntegrationDelivery row. Throws RetriableDeliveryError
 * (after logging) when the failure is worth retrying.
 */
export async function runDelivery(connectionId: string, event: IntegrationEvent): Promise<DeliveryResult> {
  const connection = await resolveConnection(connectionId);
  if (!connection || !connection.enabled) {
    const result: DeliveryResult = { status: "skipped", detail: "connection missing or disabled" };
    await recordDelivery(connectionId, event.event, result);
    return result;
  }

  const adapter = getAdapter(connection.provider);
  if (!adapter) {
    const result: DeliveryResult = { status: "skipped", detail: `no adapter for ${connection.provider}` };
    await recordDelivery(connectionId, event.event, result);
    return result;
  }

  const result = await adapter.deliver({ event, connection });
  await recordDelivery(connectionId, event.event, result);

  if (result.status === "failed" && result.retriable) {
    throw new RetriableDeliveryError(result.detail ?? "retriable delivery failure");
  }
  return result;
}

export const deliverIntegration = inngest.createFunction(
  { id: "integration-deliver", retries: 4 },
  { event: "integration/deliver" },
  async ({ event, step }) => {
    const { connectionId, event: domainEvent } = event.data as {
      connectionId: string;
      event: IntegrationEvent;
    };
    return step.run("deliver", () => runDelivery(connectionId, domainEvent));
  },
);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- deliverIntegration`
Expected: PASS, 6 tests.

- [ ] **Step 5: Register the function**

In `apps/web/src/lib/inngest/functions.ts`, add the import and array entry:
```ts
import { deliverIntegration } from "./deliverIntegration";
```
Add `deliverIntegration,` to the `functions` array.

- [ ] **Step 6: Run the full suite + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all tests PASS; no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/inngest/deliverIntegration.ts src/lib/inngest/deliverIntegration.test.ts src/lib/inngest/functions.ts
git commit -m "feat: Inngest integration-deliver function with retry classification"
```

---

## Task 10: Delivery-log prune cron

**Files:**
- Create: `apps/web/src/lib/inngest/pruneIntegrationDeliveries.ts`
- Modify: `apps/web/src/lib/inngest/functions.ts`

Follows the existing `sweepStaleCampaigns` cron pattern. No new test — it's a thin single-query cron matching an established pattern; verified via the full suite + typecheck.

- [ ] **Step 1: Implement the cron**

```ts
import { inngest } from "./client";
import { prisma } from "@/lib/prisma";

// Integration delivery rows are an audit trail, not durable state. Keep 30 days.
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export const pruneIntegrationDeliveries = inngest.createFunction(
  { id: "prune-integration-deliveries", triggers: { cron: "0 3 * * *" } },
  async ({ step }) => {
    const cutoff = new Date(Date.now() - RETENTION_MS);
    const deleted = await step.run("delete-old", async () => {
      const res = await prisma.integrationDelivery.deleteMany({ where: { createdAt: { lt: cutoff } } });
      return res.count;
    });
    return { deleted };
  },
);
```

- [ ] **Step 2: Register the function**

In `apps/web/src/lib/inngest/functions.ts`, add:
```ts
import { pruneIntegrationDeliveries } from "./pruneIntegrationDeliveries";
```
Add `pruneIntegrationDeliveries,` to the `functions` array.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/inngest/pruneIntegrationDeliveries.ts src/lib/inngest/functions.ts
git commit -m "feat: daily prune of integration delivery log"
```

---

## Task 11: Persist the Webhooks card via `IntegrationConnection`

Rewrite `/api/account/webhook` to read/write a `provider: "webhooks"` connection instead of the `Account.webhook*` columns. The front-end contract (GET returns `{ webhookUrl, webhookSecret, webhookEnabled }`; PATCH accepts `{ webhookUrl, webhookSecret, webhookEnabled }`) is unchanged, so the existing Integrations page keeps working untouched.

**Files:**
- Modify: `apps/web/src/app/api/account/webhook/route.ts`
- Create: `apps/web/src/app/api/account/webhook/route.test.ts`

- [ ] **Step 1: Read the current route**

Open `apps/web/src/app/api/account/webhook/route.ts` in full and confirm its GET/PATCH shapes and the `auth()` + `getOrCreateAccount()` usage (mirrors `api/account/integrations/route.ts`).

- [ ] **Step 2: Write the failing test for the persistence helper**

Create `apps/web/src/lib/integrations/webhookConnection.ts` logic under test. First the test `apps/web/src/lib/integrations/webhookConnection.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    integrationConnection: { findFirst: vi.fn(), upsert: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getWebhookView, saveWebhook } from "./webhookConnection";

const KEY_HEX = "0".repeat(64);

describe("webhookConnection", () => {
  beforeEach(() => {
    process.env.INTEGRATION_ENCRYPTION_KEY = KEY_HEX;
    vi.clearAllMocks();
  });

  it("getWebhookView returns disabled defaults when no connection exists", async () => {
    (prisma.integrationConnection.findFirst as any).mockResolvedValue(null);
    const view = await getWebhookView("a1");
    expect(view).toEqual({ webhookUrl: null, webhookSecret: null, webhookEnabled: false });
  });

  it("saveWebhook upserts an enabled webhooks connection with the two default events", async () => {
    (prisma.integrationConnection.findFirst as any).mockResolvedValue(null);
    (prisma.integrationConnection.upsert as any).mockResolvedValue({});
    await saveWebhook("a1", { webhookUrl: "https://x.com/h", webhookSecret: "shh", webhookEnabled: true });

    const call = (prisma.integrationConnection.upsert as any).mock.calls[0][0];
    expect(call.create.provider).toBe("webhooks");
    expect(call.create.config).toEqual({ url: "https://x.com/h" });
    expect(call.create.subscribedEvents).toEqual(["lead.captured", "variant.winner_declared"]);
    expect(call.create.enabled).toBe(true);
    // secret is encrypted, not stored raw
    expect(JSON.stringify(call.create.credentials)).not.toContain("shh");
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- webhookConnection`
Expected: FAIL — cannot find module `./webhookConnection`.

- [ ] **Step 4: Implement `webhookConnection.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { encryptBundle, maskSecret } from "./connections";
import { decryptSecret, type EncryptedSecret } from "./crypto";

const DEFAULT_EVENTS = ["lead.captured", "variant.winner_declared"];

export interface WebhookView {
  webhookUrl: string | null;
  webhookSecret: string | null; // masked
  webhookEnabled: boolean;
}

async function findWebhook(accountId: string) {
  return prisma.integrationConnection.findFirst({ where: { accountId, provider: "webhooks" } });
}

export async function getWebhookView(accountId: string): Promise<WebhookView> {
  const row = await findWebhook(accountId);
  if (!row || !row.enabled) {
    return { webhookUrl: null, webhookSecret: null, webhookEnabled: false };
  }
  const config = (row.config as { url?: string }) ?? {};
  let masked: string | null = null;
  if (row.credentials) {
    try {
      const bundle = JSON.parse(decryptSecret(row.credentials as EncryptedSecret)) as { signingSecret?: string };
      masked = bundle.signingSecret ? maskSecret(bundle.signingSecret) : null;
    } catch {
      masked = null;
    }
  }
  return { webhookUrl: config.url ?? null, webhookSecret: masked, webhookEnabled: true };
}

export async function saveWebhook(
  accountId: string,
  input: { webhookUrl?: string; webhookSecret?: string; webhookEnabled?: boolean },
): Promise<void> {
  const existing = await findWebhook(accountId);

  if (input.webhookEnabled === false) {
    if (existing) {
      await prisma.integrationConnection.upsert({
        where: { id: existing.id },
        update: { enabled: false },
        create: { accountId, provider: "webhooks", enabled: false, config: {}, subscribedEvents: DEFAULT_EVENTS },
      });
    }
    return;
  }

  const credentials = input.webhookSecret ? encryptBundle({ signingSecret: input.webhookSecret }) : existing?.credentials ?? undefined;

  await prisma.integrationConnection.upsert({
    where: { id: existing?.id ?? "__none__" },
    update: {
      enabled: true,
      config: { url: input.webhookUrl },
      ...(input.webhookSecret ? { credentials } : {}),
    },
    create: {
      accountId,
      provider: "webhooks",
      enabled: true,
      config: { url: input.webhookUrl },
      credentials,
      subscribedEvents: DEFAULT_EVENTS,
    },
  });
}
```

> Note: `upsert` with `where: { id }` requires an id. When `existing` is null we pass a sentinel that never matches, so Prisma takes the `create` branch. If your Prisma version rejects a non-existent id in `where`, switch to an explicit `findFirst`-then-`create`/`update` (both branches are already covered by the test).

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- webhookConnection`
Expected: PASS, 2 tests.

- [ ] **Step 6: Rewrite the route to use these helpers**

Replace the body of `apps/web/src/app/api/account/webhook/route.ts` so GET calls `getWebhookView(account.id)` and PATCH validates (`https://` required, same as today) then calls `saveWebhook(account.id, body)` and returns `getWebhookView(account.id)`. Keep the existing `auth()` guard and `getOrCreateAccount()` exactly as the current file uses them (match `api/account/integrations/route.ts`). Preserve the current https-only validation and error messages.

- [ ] **Step 7: Typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/integrations/webhookConnection.ts src/lib/integrations/webhookConnection.test.ts src/app/api/account/webhook/route.ts
git commit -m "feat: back the Webhooks card with IntegrationConnection"
```

---

## Task 12: Repoint emission sites to the event bus

Replace the two direct `dispatchWebhook` call sites with `emitIntegrationEvent`, then delete the now-unused `dispatchWebhook` function (keeping its payload **types**, which `types.ts` imports).

**Files:**
- Modify: `apps/web/src/app/api/widget/leads/route.ts:175-201`
- Modify: `apps/web/src/app/api/campaigns/[id]/route.ts:118-139`
- Modify: `apps/web/src/lib/webhook.ts`

- [ ] **Step 1: Read both call sites**

Open the two cited ranges and note how `account`/`acc` is loaded and what payload each builds (the shapes already match `LeadCapturedPayload` / `VariantWinnerPayload`).

- [ ] **Step 2: Update the lead-captured site**

In `apps/web/src/app/api/widget/leads/route.ts`, replace the `if (account.webhookEnabled && account.webhookUrl) { await dispatchWebhook(...) }` block (≈175-201) with:
```ts
import { emitIntegrationEvent } from "@/lib/integrations/emit";
// ...
try {
  await emitIntegrationEvent(account.id, {
    event: "lead.captured",
    payload: {
      // ...exact same payload object previously passed to dispatchWebhook...
    },
  });
} catch (err) {
  console.error("[integrations] lead.captured emit failed", err);
}
```
Keep the surrounding `after()` wrapper if present so it stays off the response path. Remove the now-unused `account.webhookEnabled`/`webhookUrl` reads if they were only used here (leave the columns in the DB — Task 13 backfills from them).

- [ ] **Step 3: Update the winner-declared site**

In `apps/web/src/app/api/campaigns/[id]/route.ts`, replace the `dispatchWebhook` winner block (≈118-139) with the equivalent `emitIntegrationEvent(acc.id, { event: "variant.winner_declared", payload: { ... } })`, wrapped in the same try/catch + `after()` as today.

- [ ] **Step 4: Delete the dead dispatch function**

In `apps/web/src/lib/webhook.ts`, delete the `dispatchWebhook` function and its `import crypto` if now unused. **Keep** the `WebhookEvent`, `LeadCapturedPayload`, and `VariantWinnerPayload` type exports — `types.ts` imports the payload types.

- [ ] **Step 5: Verify no remaining references**

Run: `grep -rn "dispatchWebhook" src/`
Expected: no matches.

- [ ] **Step 6: Typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/widget/leads/route.ts src/app/api/campaigns/[id]/route.ts src/lib/webhook.ts
git commit -m "refactor: emit lead/winner events through the integration bus"
```

---

## Task 13: Backfill existing connections

One-time script that migrates `Account.webhookUrl/Secret/Enabled` and the `klaviyo/mailchimp/hubspot` keys from `Account.integrationCredentials` into `IntegrationConnection` rows with re-encrypted secrets. The old columns are left in place (dropped in a later phase after verification). The Zapier facade key is intentionally skipped (see spec §5.4).

**Files:**
- Create: `apps/web/scripts/backfill-integration-connections.ts`

- [ ] **Step 1: Implement the script**

```ts
/**
 * One-time backfill: migrate legacy Account.webhook* columns and the
 * integrationCredentials JSON blob into IntegrationConnection rows.
 * Idempotent: skips an (account, provider) that already has a connection.
 * Run with: npx tsx scripts/backfill-integration-connections.ts
 */
import { prisma } from "@/lib/prisma";
import { encryptBundle } from "@/lib/integrations/connections";

const SYNC_PROVIDERS = ["klaviyo", "mailchimp", "hubspot"] as const;
const DEFAULT_EVENTS = ["lead.captured", "variant.winner_declared"];

async function main() {
  const accounts = await prisma.account.findMany({
    select: { id: true, webhookUrl: true, webhookSecret: true, webhookEnabled: true, integrationCredentials: true },
  });

  let created = 0;
  for (const acc of accounts) {
    const existing = await prisma.integrationConnection.findMany({
      where: { accountId: acc.id }, select: { provider: true },
    });
    const have = new Set(existing.map((e) => e.provider));

    // Webhooks
    if (acc.webhookUrl && !have.has("webhooks")) {
      await prisma.integrationConnection.create({
        data: {
          accountId: acc.id, provider: "webhooks", enabled: Boolean(acc.webhookEnabled),
          config: { url: acc.webhookUrl },
          credentials: acc.webhookSecret ? encryptBundle({ signingSecret: acc.webhookSecret }) : undefined,
          subscribedEvents: DEFAULT_EVENTS,
        },
      });
      created++;
    }

    // Sync providers from integrationCredentials JSON: { [id]: { apiKey, connectedAt } }
    const creds = (acc.integrationCredentials as Record<string, { apiKey?: string }> | null) ?? {};
    for (const provider of SYNC_PROVIDERS) {
      const apiKey = creds[provider]?.apiKey;
      if (apiKey && !have.has(provider)) {
        await prisma.integrationConnection.create({
          data: {
            accountId: acc.id, provider, enabled: true, config: {},
            credentials: encryptBundle({ apiKey }),
            subscribedEvents: ["lead.captured"],
          },
        });
        created++;
      }
    }
    // NOTE: creds.zapier is intentionally skipped — the facade key has no target
    // in the URL-based Zapier adapter (spec §5.4).
  }

  console.log(`Backfill complete. Created ${created} connections across ${accounts.length} accounts.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Ensure a script runner is available**

If `tsx` is not already available, install it:
```bash
npm install -D tsx
```

- [ ] **Step 3: Dry-run against a dev/staging database**

Run (with a **non-production** `DATABASE_URL` and `INTEGRATION_ENCRYPTION_KEY` set):
```bash
npx tsx scripts/backfill-integration-connections.ts
```
Expected: prints the created count; re-running prints `Created 0` (idempotent).

- [ ] **Step 4: Verify a migrated row resolves**

In a Node REPL or a scratch script, call `resolveConnection(id)` on a created webhook connection and confirm `secrets.signingSecret` decrypts to the original value.

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill-integration-connections.ts package.json package-lock.json
git commit -m "feat: backfill script for legacy integration data"
```

- [ ] **Step 6: Run the backfill ONCE, manually, from a maintainer's machine (NOT in CI)**

Decision: the backfill is a one-time data migration and is deliberately kept OUT of the
deploy pipeline, so CI never auto-runs a data migration against production and no
`INTEGRATION_ENCRYPTION_KEY` is needed in CI secrets. `.github/workflows/migrate.yml`
carries only `prisma migrate deploy` (plus a comment pointing here).

After the schema migration has been applied to the target database (via the normal deploy),
run the backfill once, locally, against that database:
```bash
cd apps/web
INTEGRATION_ENCRYPTION_KEY=<the-prod-key> DATABASE_URL=<prod-db-url> \
  npx tsx scripts/backfill-integration-connections.ts
```
It prints the created count and is idempotent (safe to re-run; skips already-migrated
`(account, provider)` pairs).

- [ ] **Step 7: One-time secrets setup (operational, done by the repo owner)**

Only ONE place needs the key now:
- **Vercel env var** `INTEGRATION_ENCRYPTION_KEY` (all environments) so the running app can
  encrypt/decrypt credentials at request time. Generated once with `openssl rand -hex 32`.

The maintainer running Step 6 uses that same key value in their local shell for the one-time
backfill. No GitHub Actions secret is required.

---

## Phase 0 Definition of Done

- [ ] `npm test` — all suites pass.
- [ ] `npx tsc --noEmit` — no type errors.
- [ ] `INTEGRATION_ENCRYPTION_KEY` set in all environments (local `.env`, Vercel).
- [ ] Migration applied; backfill run on staging and verified idempotent.
- [ ] Manual end-to-end: connect a webhook in the Integrations UI → capture a test lead → the delivery reaches the endpoint (use a requestbin URL) AND an `IntegrationDelivery` row with `status: "success"` exists.
- [ ] No remaining references to `dispatchWebhook`.

---

## Self-Review (completed by plan author)

**Spec coverage (Phase 0 scope only):**
- Event bus (§3) → Tasks 8, 9. Adapter interface + registry (§7) → Tasks 4, 6. Webhook adapter (§7) → Task 5. Data model `IntegrationConnection` + `IntegrationDelivery` (§5.1, §5.3) → Task 3. Encryption at rest (§6.1) → Task 2, used in 7/11/13. Masked reads (§6.2) → Task 7 (`maskSecret`), Task 11. Migration from legacy fields (§5.4) → Tasks 11 (dual-write path) + 13 (backfill), Zapier facade skipped. Reliability/retries (§10) → Task 9. Delivery log + prune (§5.3) → Tasks 9, 10. Repoint emission (§3) → Task 12.
- Deferred by design (documented in File Structure): `MessageTemplate`/`rules` (§5.2, §8), consent gating (§6.3), SSRF private-range guard (§6.4 — Phase 0 keeps the existing https-only check; private-range blocking lands with the public multi-URL adapters in Phase 1), `gift.claimed` (§4), UI redesign + per-event toggles (§9). None are required for a working, testable Phase 0.

**Placeholder scan:** No TBD/TODO. Every code step contains complete code. The one prose "…exact same payload object…" in Task 12 Step 2 refers to code the engineer copies from the cited existing lines they read in Step 1 — acceptable because the source is pinned and reading it is a required prior step.

**Type consistency:** `EncryptedSecret` (Task 2) is consumed unchanged in Tasks 7, 11. `ResolvedConnection`/`DeliveryResult`/`IntegrationEvent` (Task 4) are used identically in Tasks 5, 7, 8, 9. `encryptBundle`/`maskSecret`/`resolveConnection`/`recordDelivery` (Task 7) are called with matching signatures in Tasks 9, 11, 13. `runDelivery`/`RetriableDeliveryError` (Task 9) match their tests. Inngest event name `"integration/deliver"` is identical in emit (Task 8) and the delivery function (Task 9).

---

## Execution Handoff

Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session with checkpoints for review.

(Phases 1–3 will each get their own plan once Phase 0 is merged.)

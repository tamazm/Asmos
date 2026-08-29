# Integrations Phase 1 — Webhook Integrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 6 working, event-driven integrations on the Phase 0 bus — Zapier, Make, n8n (automation: signed JSON envelope) and Slack, Discord, Microsoft Teams (notifications: channel-formatted messages) — each connectable via a pasted URL with per-event toggles.

**Architecture:** Each integration is a small adapter plugged into the existing registry + Inngest delivery pipeline. Zapier/Make/n8n reuse a shared HTTP-post helper to deliver the same signed envelope the `webhooks` adapter sends; Slack/Discord/Teams format a channel-native message from a shared event summary. A single generic `/api/integrations/connections` endpoint handles connect/disconnect + event subscription for all six (URL-only, no stored secret). The Integrations page gains a reusable card component grouped into Automation and Notifications sections.

**Tech Stack:** Next.js 16 (custom fork — see `apps/web/AGENTS.md`), Prisma 7 + Postgres, Inngest 4, Vitest. Package manager **npm**; all commands from `apps/web/`.

**Spec:** `docs/superpowers/specs/2026-08-28-integrations-automation-design.md`
**Builds on:** Phase 0 (`docs/superpowers/plans/2026-08-29-integrations-phase0-foundation.md`) — the event bus, `IntegrationConnection`/`IntegrationDelivery` models, adapter interface (`src/lib/integrations/types.ts`), registry (`registry.ts`), and the `webhooks` adapter are all live.

> **Repo facts (avoid false gates):** `npx tsc --noEmit` has ~143 PRE-EXISTING errors (the app ships via `next build`, not raw tsc). The type gate for a task is: no NEW tsc error references a file the task created/changed. The provider enum already contains all six values (added in Phase 0) — **no DB migration is needed in Phase 1.** Prisma has a known local type-inference gap; add minimal explicit annotations where `findMany`/`include` results are otherwise `any`/implicit.

---

## File Structure

**New files**
- `apps/web/src/lib/integrations/adapters/httpDelivery.ts` — `classifyStatus` + `postWebhook` (fetch + timeout + optional HMAC), shared by all webhook-style adapters.
- `apps/web/src/lib/integrations/adapters/httpDelivery.test.ts`
- `apps/web/src/lib/integrations/adapters/summarizeEvent.ts` — channel-agnostic `{ emoji, title, lines }` summary of an `IntegrationEvent`.
- `apps/web/src/lib/integrations/adapters/summarizeEvent.test.ts`
- `apps/web/src/lib/integrations/adapters/envelopeAdapters.ts` — `zapierAdapter`, `makeAdapter`, `n8nAdapter` (signed-envelope delivery via a factory).
- `apps/web/src/lib/integrations/adapters/envelopeAdapters.test.ts`
- `apps/web/src/lib/integrations/adapters/slackAdapter.ts` + `.test.ts`
- `apps/web/src/lib/integrations/adapters/discordAdapter.ts` + `.test.ts`
- `apps/web/src/lib/integrations/adapters/teamsAdapter.ts` + `.test.ts`
- `apps/web/src/lib/integrations/manageConnections.ts` — generic URL-provider CRUD + connection views (list/save/remove), used by the API.
- `apps/web/src/lib/integrations/manageConnections.test.ts`
- `apps/web/src/app/api/integrations/connections/route.ts` — GET/PATCH/DELETE for the six URL providers.
- `apps/web/src/components/integrations/ProviderWebhookCard.tsx` — reusable connect card (paste URL, event toggles, status, last delivery).

**Modified files**
- `apps/web/src/lib/integrations/adapters/webhookAdapter.ts` — refactor `deliver` to use `postWebhook` (DRY; Phase 0 tests stay green).
- `apps/web/src/lib/integrations/registry.ts` — register the 6 new adapters.
- `apps/web/src/app/(dashboard)/integrations/page.tsx` — add the 6 provider cards, grouped Automation / Notifications.

**Not in Phase 1 (later):** Klaviyo/Mailchimp/HubSpot sync (Phase 2), Mailgun/Twilio messaging + template dashboard (Phase 3), `gift.claimed`, and a full visual redesign of the tab. Consent-gating is not needed here (these adapters are merchant-internal, not lead-directed).

---

## Task 1: Shared HTTP delivery helper + refactor webhook adapter

**Files:**
- Create: `apps/web/src/lib/integrations/adapters/httpDelivery.ts`, `httpDelivery.test.ts`
- Modify: `apps/web/src/lib/integrations/adapters/webhookAdapter.ts`

- [ ] **Step 1: Write the failing test** `httpDelivery.test.ts`

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { classifyStatus, postWebhook } from "./httpDelivery";

describe("classifyStatus", () => {
  it("maps 2xx to success", () => { expect(classifyStatus(200)).toEqual({ status: "success" }); });
  it("maps 500 to retriable failure", () => { expect(classifyStatus(500)).toMatchObject({ status: "failed", retriable: true }); });
  it("maps 429 to retriable failure", () => { expect(classifyStatus(429)).toMatchObject({ status: "failed", retriable: true }); });
  it("maps 400 to non-retriable failure", () => { expect(classifyStatus(400)).toMatchObject({ status: "failed", retriable: false }); });
});

describe("postWebhook", () => {
  afterEach(() => vi.restoreAllMocks());

  it("POSTs JSON and returns success on 2xx", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const res = await postWebhook("https://x.com/h", { hello: "world" }, { event: "lead.captured" });
    expect(res.status).toBe("success");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://x.com/h");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ hello: "world" });
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-Asmos-Event"]).toBe("lead.captured");
    expect(headers["X-Asmos-Signature"]).toBeUndefined();
  });

  it("adds an HMAC signature when a secret is given", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    await postWebhook("https://x.com/h", { a: 1 }, { secret: "shh" });
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["X-Asmos-Signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it("returns retriable failure on a network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNRESET"));
    const res = await postWebhook("https://x.com/h", {});
    expect(res).toMatchObject({ status: "failed", retriable: true });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- httpDelivery`
Expected: FAIL — cannot find module `./httpDelivery`.

- [ ] **Step 3: Implement `httpDelivery.ts`**

```ts
import crypto from "crypto";
import type { DeliveryResult } from "../types";

export function classifyStatus(status: number): DeliveryResult {
  if (status >= 200 && status < 300) return { status: "success" };
  const retriable = status === 408 || status === 429 || status >= 500;
  return { status: "failed", detail: `HTTP ${status}`, retriable };
}

/** POST a JSON body to a merchant URL. Optionally HMAC-signs it. Never throws for
 *  provider errors — returns a classified DeliveryResult; retriable on network error. */
export async function postWebhook(
  url: string,
  body: unknown,
  opts: { secret?: string | null; event?: string } = {},
): Promise<DeliveryResult> {
  const payload = JSON.stringify(body);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Asmos-Webhook/1.0",
    "X-Asmos-Timestamp": String(Date.now()),
  };
  if (opts.event) headers["X-Asmos-Event"] = opts.event;
  if (opts.secret) {
    headers["X-Asmos-Signature"] = `sha256=${crypto.createHmac("sha256", opts.secret).update(payload).digest("hex")}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, { method: "POST", headers, body: payload, signal: controller.signal });
    return classifyStatus(res.status);
  } catch (err) {
    return { status: "failed", detail: err instanceof Error ? err.message : "network error", retriable: true };
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- httpDelivery`
Expected: PASS, 7 tests.

- [ ] **Step 5: Refactor `webhookAdapter.ts` to use the helper**

Replace the body of `webhookAdapter.deliver` and remove the now-unused local `classify`/`crypto`/fetch code, keeping `validate` as-is:
```ts
import type { IntegrationAdapter, ValidationResult } from "../types";
import { postWebhook } from "./httpDelivery";

export const webhookAdapter: IntegrationAdapter = {
  provider: "webhooks",
  kind: "webhook",

  async validate({ config }): Promise<ValidationResult> {
    const url = typeof config.url === "string" ? config.url : "";
    if (!url.startsWith("https://")) return { ok: false, error: "Endpoint URL must start with https://" };
    return { ok: true };
  },

  async deliver({ event, connection }) {
    return postWebhook(String(connection.config.url ?? ""), event, {
      secret: connection.secrets.signingSecret ?? null,
      event: event.event,
    });
  },
};
```

- [ ] **Step 6: Verify Phase 0 webhook tests still pass**

Run: `npm test -- webhookAdapter httpDelivery`
Expected: PASS (webhookAdapter 7 + httpDelivery 7). The webhookAdapter signature/classification tests must still be green after the refactor.

- [ ] **Step 7: tsc gate + commit**

Run: `npx tsc --noEmit 2>&1 | grep -E "httpDelivery|webhookAdapter"` → expect no lines.
```bash
git add src/lib/integrations/adapters/httpDelivery.ts src/lib/integrations/adapters/httpDelivery.test.ts src/lib/integrations/adapters/webhookAdapter.ts
git commit -m "refactor: shared postWebhook helper; webhook adapter uses it"
```

---

## Task 2: Event summarizer

**Files:**
- Create: `apps/web/src/lib/integrations/adapters/summarizeEvent.ts`, `summarizeEvent.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { summarizeEvent } from "./summarizeEvent";
import type { IntegrationEvent } from "../types";

const lead: IntegrationEvent = {
  event: "lead.captured",
  payload: {
    campaign_id: "c1", campaign_name: "Summer Sale", variant_id: "v1", variant_name: "B",
    lead: { email: "jane@x.com", name: "Jane", phone: null, consent_given: true, captured_at: "2026-08-29T00:00:00.000Z" },
    reward: { label: "10% off", type: "COUPON", coupon_code: "SAVE10" },
  },
};
const winner: IntegrationEvent = {
  event: "variant.winner_declared",
  payload: { campaign_id: "c1", campaign_name: "Summer Sale", winning_variant_id: "v1", winning_variant_name: "B", declared_at: "2026-08-29T00:00:00.000Z" },
};

describe("summarizeEvent", () => {
  it("summarizes a lead with name and coupon", () => {
    const s = summarizeEvent(lead);
    expect(s.emoji).toBe("🎉");
    expect(s.title).toBe("New lead captured");
    expect(s.lines).toContain("Name: Jane");
    expect(s.lines).toContain("Email: jane@x.com");
    expect(s.lines).toContain("Coupon: SAVE10");
    expect(s.lines.some((l) => l.includes("Summer Sale"))).toBe(true);
  });

  it("omits name and coupon lines when absent", () => {
    const s = summarizeEvent({ ...lead, payload: { ...lead.payload, lead: { ...lead.payload.lead, name: null }, reward: null } } as IntegrationEvent);
    expect(s.lines.some((l) => l.startsWith("Name:"))).toBe(false);
    expect(s.lines.some((l) => l.startsWith("Coupon:"))).toBe(false);
    expect(s.lines).toContain("Email: jane@x.com");
  });

  it("summarizes a winner event", () => {
    const s = summarizeEvent(winner);
    expect(s.emoji).toBe("🏆");
    expect(s.title).toBe("Winner declared");
    expect(s.lines).toContain("Winning variant: B");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- summarizeEvent`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement `summarizeEvent.ts`**

```ts
import type { IntegrationEvent } from "../types";

export interface EventSummary {
  emoji: string;
  title: string;
  lines: string[];
}

export function summarizeEvent(event: IntegrationEvent): EventSummary {
  if (event.event === "lead.captured") {
    const p = event.payload;
    const lines: string[] = [];
    if (p.lead.name) lines.push(`Name: ${p.lead.name}`);
    lines.push(`Email: ${p.lead.email ?? "—"}`);
    if (p.lead.phone) lines.push(`Phone: ${p.lead.phone}`);
    lines.push(`Campaign: ${p.campaign_name} · Variant: ${p.variant_name}`);
    if (p.reward?.coupon_code) lines.push(`Coupon: ${p.reward.coupon_code}`);
    return { emoji: "🎉", title: "New lead captured", lines };
  }
  const p = event.payload;
  return {
    emoji: "🏆",
    title: "Winner declared",
    lines: [`Campaign: ${p.campaign_name}`, `Winning variant: ${p.winning_variant_name}`],
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- summarizeEvent`
Expected: PASS, 3 tests.

- [ ] **Step 5: tsc gate + commit**

Run: `npx tsc --noEmit 2>&1 | grep "summarizeEvent"` → no lines.
```bash
git add src/lib/integrations/adapters/summarizeEvent.ts src/lib/integrations/adapters/summarizeEvent.test.ts
git commit -m "feat: channel-agnostic event summarizer"
```

---

## Task 3: Automation adapters (Zapier, Make, n8n)

**Files:**
- Create: `apps/web/src/lib/integrations/adapters/envelopeAdapters.ts`, `envelopeAdapters.test.ts`
- Modify: `apps/web/src/lib/integrations/registry.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { zapierAdapter, makeAdapter, n8nAdapter } from "./envelopeAdapters";
import type { ResolvedConnection, IntegrationEvent } from "../types";

const event: IntegrationEvent = {
  event: "lead.captured",
  payload: {
    campaign_id: "c1", campaign_name: "S", variant_id: "v1", variant_name: "B",
    lead: { email: "j@x.com", name: null, phone: null, consent_given: true, captured_at: "2026-08-29T00:00:00.000Z" },
    reward: null,
  },
};
function conn(provider: ResolvedConnection["provider"]): ResolvedConnection {
  return { id: "c", accountId: "a", provider, enabled: true, config: { url: "https://hooks.x.com/abc" }, subscribedEvents: ["lead.captured"], secrets: {} };
}

describe("envelope adapters", () => {
  afterEach(() => vi.restoreAllMocks());

  it("each adapter carries its own provider id and webhook kind", () => {
    expect([zapierAdapter.provider, makeAdapter.provider, n8nAdapter.provider]).toEqual(["zapier", "make", "n8n"]);
    expect([zapierAdapter.kind, makeAdapter.kind, n8nAdapter.kind]).toEqual(["webhook", "webhook", "webhook"]);
  });

  it("POSTs the raw event envelope to the configured url", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const res = await zapierAdapter.deliver({ event, connection: conn("zapier") });
    expect(res.status).toBe("success");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hooks.x.com/abc");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(event);
  });

  it("validate rejects non-https", async () => {
    expect((await makeAdapter.validate({ config: { url: "http://x" }, secrets: {} })).ok).toBe(false);
    expect((await makeAdapter.validate({ config: { url: "https://x" }, secrets: {} })).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- envelopeAdapters`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement `envelopeAdapters.ts`**

```ts
import type { IntegrationAdapter, IntegrationProvider } from "../types";
import { postWebhook } from "./httpDelivery";

function createEnvelopeAdapter(provider: IntegrationProvider): IntegrationAdapter {
  return {
    provider,
    kind: "webhook",
    async validate({ config }) {
      const url = typeof config.url === "string" ? config.url : "";
      return url.startsWith("https://") ? { ok: true } : { ok: false, error: "Endpoint URL must start with https://" };
    },
    async deliver({ event, connection }) {
      return postWebhook(String(connection.config.url ?? ""), event, {
        secret: connection.secrets.signingSecret ?? null,
        event: event.event,
      });
    },
  };
}

export const zapierAdapter = createEnvelopeAdapter("zapier");
export const makeAdapter = createEnvelopeAdapter("make");
export const n8nAdapter = createEnvelopeAdapter("n8n");
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- envelopeAdapters`
Expected: PASS, 3 tests.

- [ ] **Step 5: Register the three adapters** in `registry.ts`

```ts
import type { IntegrationAdapter, IntegrationProvider } from "./types";
import { webhookAdapter } from "./adapters/webhookAdapter";
import { zapierAdapter, makeAdapter, n8nAdapter } from "./adapters/envelopeAdapters";

const ADAPTERS: Partial<Record<IntegrationProvider, IntegrationAdapter>> = {
  webhooks: webhookAdapter,
  zapier: zapierAdapter,
  make: makeAdapter,
  n8n: n8nAdapter,
};

export function getAdapter(provider: IntegrationProvider): IntegrationAdapter | undefined {
  return ADAPTERS[provider];
}
```

- [ ] **Step 6: Verify registry + tsc, commit**

Run: `npm test -- registry envelopeAdapters` (registry's Phase 0 test still passes; `getAdapter("zapier")` now resolves — the existing test only checks `webhooks` + an unmapped provider, so it stays green).
Run: `npx tsc --noEmit 2>&1 | grep -E "envelopeAdapters|registry"` → no lines.
```bash
git add src/lib/integrations/adapters/envelopeAdapters.ts src/lib/integrations/adapters/envelopeAdapters.test.ts src/lib/integrations/registry.ts
git commit -m "feat: Zapier/Make/n8n envelope adapters"
```

---

## Task 4: Slack adapter

**Files:**
- Create: `apps/web/src/lib/integrations/adapters/slackAdapter.ts`, `slackAdapter.test.ts`
- Modify: `apps/web/src/lib/integrations/registry.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { slackAdapter } from "./slackAdapter";
import type { ResolvedConnection, IntegrationEvent } from "../types";

const event: IntegrationEvent = {
  event: "lead.captured",
  payload: {
    campaign_id: "c1", campaign_name: "Summer", variant_id: "v1", variant_name: "B",
    lead: { email: "j@x.com", name: "Jane", phone: null, consent_given: true, captured_at: "2026-08-29T00:00:00.000Z" },
    reward: { label: "10% off", type: "COUPON", coupon_code: "SAVE10" },
  },
};
const connection: ResolvedConnection = {
  id: "c", accountId: "a", provider: "slack", enabled: true,
  config: { url: "https://hooks.slack.com/services/XXX" }, subscribedEvents: ["lead.captured"], secrets: {},
};

describe("slackAdapter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("posts a Slack text message summarizing the event", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));
    const res = await slackAdapter.deliver({ event, connection });
    expect(res.status).toBe("success");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(typeof body.text).toBe("string");
    expect(body.text).toContain("New lead captured");
    expect(body.text).toContain("jane@x.com".replace("jane", "j")); // j@x.com
    expect(body.text).toContain("SAVE10");
  });

  it("validate requires https", async () => {
    expect((await slackAdapter.validate({ config: { url: "http://x" }, secrets: {} })).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- slackAdapter`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement `slackAdapter.ts`**

```ts
import type { IntegrationAdapter } from "../types";
import { postWebhook } from "./httpDelivery";
import { summarizeEvent } from "./summarizeEvent";

export const slackAdapter: IntegrationAdapter = {
  provider: "slack",
  kind: "webhook",
  async validate({ config }) {
    const url = typeof config.url === "string" ? config.url : "";
    return url.startsWith("https://") ? { ok: true } : { ok: false, error: "Slack webhook URL must start with https://" };
  },
  async deliver({ event, connection }) {
    const s = summarizeEvent(event);
    const text = `${s.emoji} *${s.title}*\n${s.lines.join("\n")}`;
    return postWebhook(String(connection.config.url ?? ""), { text });
  },
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- slackAdapter`
Expected: PASS, 2 tests.

- [ ] **Step 5: Register in `registry.ts`**

Add the import `import { slackAdapter } from "./adapters/slackAdapter";` and the entry `slack: slackAdapter,` to the `ADAPTERS` map.

- [ ] **Step 6: tsc gate + commit**

Run: `npx tsc --noEmit 2>&1 | grep -E "slackAdapter|registry"` → no lines.
```bash
git add src/lib/integrations/adapters/slackAdapter.ts src/lib/integrations/adapters/slackAdapter.test.ts src/lib/integrations/registry.ts
git commit -m "feat: Slack notification adapter"
```

---

## Task 5: Discord adapter

**Files:**
- Create: `apps/web/src/lib/integrations/adapters/discordAdapter.ts`, `discordAdapter.test.ts`
- Modify: `apps/web/src/lib/integrations/registry.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { discordAdapter } from "./discordAdapter";
import type { ResolvedConnection, IntegrationEvent } from "../types";

const event: IntegrationEvent = {
  event: "variant.winner_declared",
  payload: { campaign_id: "c1", campaign_name: "Summer", winning_variant_id: "v1", winning_variant_name: "B", declared_at: "2026-08-29T00:00:00.000Z" },
};
const connection: ResolvedConnection = {
  id: "c", accountId: "a", provider: "discord", enabled: true,
  config: { url: "https://discord.com/api/webhooks/XXX/YYY" }, subscribedEvents: ["variant.winner_declared"], secrets: {},
};

describe("discordAdapter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("posts a Discord content message", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    const res = await discordAdapter.deliver({ event, connection });
    expect(res.status).toBe("success");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(typeof body.content).toBe("string");
    expect(body.content).toContain("Winner declared");
    expect(body.content).toContain("Summer");
  });

  it("validate requires https", async () => {
    expect((await discordAdapter.validate({ config: { url: "ftp://x" }, secrets: {} })).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- discordAdapter`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement `discordAdapter.ts`**

```ts
import type { IntegrationAdapter } from "../types";
import { postWebhook } from "./httpDelivery";
import { summarizeEvent } from "./summarizeEvent";

export const discordAdapter: IntegrationAdapter = {
  provider: "discord",
  kind: "webhook",
  async validate({ config }) {
    const url = typeof config.url === "string" ? config.url : "";
    return url.startsWith("https://") ? { ok: true } : { ok: false, error: "Discord webhook URL must start with https://" };
  },
  async deliver({ event, connection }) {
    const s = summarizeEvent(event);
    const content = `${s.emoji} **${s.title}**\n${s.lines.join("\n")}`;
    return postWebhook(String(connection.config.url ?? ""), { content });
  },
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- discordAdapter`
Expected: PASS, 2 tests.

- [ ] **Step 5: Register in `registry.ts`**

Add `import { discordAdapter } from "./adapters/discordAdapter";` and `discord: discordAdapter,` to `ADAPTERS`.

- [ ] **Step 6: tsc gate + commit**

Run: `npx tsc --noEmit 2>&1 | grep -E "discordAdapter|registry"` → no lines.
```bash
git add src/lib/integrations/adapters/discordAdapter.ts src/lib/integrations/adapters/discordAdapter.test.ts src/lib/integrations/registry.ts
git commit -m "feat: Discord notification adapter"
```

---

## Task 6: Microsoft Teams adapter (+ full registry test)

**Files:**
- Create: `apps/web/src/lib/integrations/adapters/teamsAdapter.ts`, `teamsAdapter.test.ts`
- Modify: `apps/web/src/lib/integrations/registry.ts`, `registry.test.ts`

- [ ] **Step 1: Write the failing test** `teamsAdapter.test.ts`

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { teamsAdapter } from "./teamsAdapter";
import type { ResolvedConnection, IntegrationEvent } from "../types";

const event: IntegrationEvent = {
  event: "lead.captured",
  payload: {
    campaign_id: "c1", campaign_name: "Summer", variant_id: "v1", variant_name: "B",
    lead: { email: "j@x.com", name: null, phone: null, consent_given: true, captured_at: "2026-08-29T00:00:00.000Z" },
    reward: null,
  },
};
const connection: ResolvedConnection = {
  id: "c", accountId: "a", provider: "teams", enabled: true,
  config: { url: "https://outlook.office.com/webhook/XXX" }, subscribedEvents: ["lead.captured"], secrets: {},
};

describe("teamsAdapter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("posts a MessageCard payload", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const res = await teamsAdapter.deliver({ event, connection });
    expect(res.status).toBe("success");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body["@type"]).toBe("MessageCard");
    expect(body.title).toContain("New lead captured");
    expect(typeof body.text).toBe("string");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- teamsAdapter`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement `teamsAdapter.ts`**

```ts
import type { IntegrationAdapter } from "../types";
import { postWebhook } from "./httpDelivery";
import { summarizeEvent } from "./summarizeEvent";

export const teamsAdapter: IntegrationAdapter = {
  provider: "teams",
  kind: "webhook",
  async validate({ config }) {
    const url = typeof config.url === "string" ? config.url : "";
    return url.startsWith("https://") ? { ok: true } : { ok: false, error: "Teams webhook URL must start with https://" };
  },
  async deliver({ event, connection }) {
    const s = summarizeEvent(event);
    const body = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      summary: s.title,
      themeColor: "6366F1",
      title: `${s.emoji} ${s.title}`,
      text: s.lines.join("  \n"),
    };
    return postWebhook(String(connection.config.url ?? ""), body);
  },
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- teamsAdapter`
Expected: PASS, 1 test.

- [ ] **Step 5: Register in `registry.ts`** — add `import { teamsAdapter } from "./adapters/teamsAdapter";` and `teams: teamsAdapter,` to `ADAPTERS`.

- [ ] **Step 6: Add a full-registry test** — append to `registry.test.ts`:

```ts
it("resolves all six Phase 1 providers", () => {
  for (const p of ["webhooks", "zapier", "make", "n8n", "slack", "discord", "teams"] as const) {
    expect(getAdapter(p)?.provider).toBe(p);
  }
});
```

- [ ] **Step 7: Verify + tsc + commit**

Run: `npm test -- teamsAdapter registry` (registry now has the new assertion + the Phase 0 ones — all pass).
Run: `npx tsc --noEmit 2>&1 | grep -E "teamsAdapter|registry"` → no lines.
```bash
git add src/lib/integrations/adapters/teamsAdapter.ts src/lib/integrations/adapters/teamsAdapter.test.ts src/lib/integrations/registry.ts src/lib/integrations/registry.test.ts
git commit -m "feat: Microsoft Teams adapter + full registry coverage"
```

---

## Task 7: Generic connection management helper

**Files:**
- Create: `apps/web/src/lib/integrations/manageConnections.ts`, `manageConnections.test.ts`

Handles the six URL-based providers: list their state (with last-delivery), upsert (single per provider, field-conditional), and remove. Prisma is mocked in tests.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    integrationConnection: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { isUrlProvider, listConnectionViews, saveConnection, removeConnection } from "./manageConnections";

describe("manageConnections", () => {
  beforeEach(() => vi.clearAllMocks());

  it("isUrlProvider accepts the six and rejects others", () => {
    expect(isUrlProvider("slack")).toBe(true);
    expect(isUrlProvider("webhooks")).toBe(false); // webhooks has its own route
    expect(isUrlProvider("klaviyo")).toBe(false);
    expect(isUrlProvider(3)).toBe(false);
  });

  it("listConnectionViews returns a view per provider, connected only where a row exists", async () => {
    (prisma.integrationConnection.findMany as any).mockResolvedValue([
      { provider: "slack", enabled: true, config: { url: "https://s" }, subscribedEvents: ["lead.captured"],
        deliveries: [{ status: "success", createdAt: new Date("2026-08-29T10:00:00Z") }] },
    ]);
    const views = await listConnectionViews("a1");
    const slack = views.find((v) => v.provider === "slack")!;
    expect(slack.connected).toBe(true);
    expect(slack.url).toBe("https://s");
    expect(slack.lastDelivery).toEqual({ status: "success", at: "2026-08-29T10:00:00.000Z" });
    const zap = views.find((v) => v.provider === "zapier")!;
    expect(zap.connected).toBe(false);
    expect(zap.url).toBeNull();
  });

  it("saveConnection rejects an unknown provider", async () => {
    await expect(saveConnection("a1", "klaviyo" as any, { url: "https://x" })).rejects.toThrow(/provider/i);
  });

  it("saveConnection rejects a non-https url", async () => {
    await expect(saveConnection("a1", "slack", { url: "http://x" })).rejects.toThrow(/https/i);
  });

  it("saveConnection creates a new connection with default events when none exists", async () => {
    (prisma.integrationConnection.findFirst as any).mockResolvedValue(null);
    (prisma.integrationConnection.create as any).mockResolvedValue({});
    await saveConnection("a1", "slack", { url: "https://s" });
    const data = (prisma.integrationConnection.create as any).mock.calls[0][0].data;
    expect(data.provider).toBe("slack");
    expect(data.config).toEqual({ url: "https://s" });
    expect(data.enabled).toBe(true);
    expect(data.subscribedEvents).toEqual(["lead.captured", "variant.winner_declared"]);
  });

  it("saveConnection updates only provided fields on an existing row", async () => {
    (prisma.integrationConnection.findFirst as any).mockResolvedValue({ id: "c1" });
    (prisma.integrationConnection.update as any).mockResolvedValue({});
    await saveConnection("a1", "slack", { subscribedEvents: ["lead.captured"] });
    const call = (prisma.integrationConnection.update as any).mock.calls[0][0];
    expect(call.where).toEqual({ id: "c1" });
    expect(call.data).toEqual({ subscribedEvents: ["lead.captured"] }); // url/enabled untouched
  });

  it("removeConnection deletes the provider's row", async () => {
    (prisma.integrationConnection.deleteMany as any).mockResolvedValue({ count: 1 });
    await removeConnection("a1", "slack");
    expect(prisma.integrationConnection.deleteMany).toHaveBeenCalledWith({ where: { accountId: "a1", provider: "slack" } });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- manageConnections`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement `manageConnections.ts`**

```ts
import { prisma } from "@/lib/prisma";
import type { IntegrationProvider } from "./types";

const URL_PROVIDERS = ["zapier", "make", "n8n", "slack", "discord", "teams"] as const;
type UrlProvider = (typeof URL_PROVIDERS)[number];
const CANONICAL_EVENTS = ["lead.captured", "variant.winner_declared"];

export function isUrlProvider(p: unknown): p is UrlProvider {
  return typeof p === "string" && (URL_PROVIDERS as readonly string[]).includes(p);
}

export interface ConnectionView {
  provider: UrlProvider;
  connected: boolean;
  url: string | null;
  subscribedEvents: string[];
  lastDelivery: { status: string; at: string } | null;
}

export async function listConnectionViews(accountId: string): Promise<ConnectionView[]> {
  const rows = await prisma.integrationConnection.findMany({
    where: { accountId, provider: { in: [...URL_PROVIDERS] } },
    include: { deliveries: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  return URL_PROVIDERS.map((provider): ConnectionView => {
    const row = rows.find((r: { provider: string }) => r.provider === provider);
    if (!row || !row.enabled) {
      return { provider, connected: false, url: null, subscribedEvents: [], lastDelivery: null };
    }
    const url = (row.config as { url?: string } | null)?.url ?? null;
    const last = row.deliveries[0];
    return {
      provider,
      connected: Boolean(url),
      url,
      subscribedEvents: row.subscribedEvents ?? [],
      lastDelivery: last ? { status: last.status, at: last.createdAt.toISOString() } : null,
    };
  });
}

export async function saveConnection(
  accountId: string,
  provider: UrlProvider,
  input: { url?: string; subscribedEvents?: string[] },
): Promise<void> {
  if (!isUrlProvider(provider)) throw new Error(`Unknown provider: ${String(provider)}`);
  if (input.url !== undefined && !input.url.startsWith("https://")) {
    throw new Error("Endpoint URL must start with https://");
  }
  const events = input.subscribedEvents?.filter((e) => CANONICAL_EVENTS.includes(e));

  const existing = await prisma.integrationConnection.findFirst({ where: { accountId, provider } });

  if (existing) {
    const data: { enabled?: boolean; config?: { url: string }; subscribedEvents?: string[] } = {};
    if (input.url !== undefined) { data.config = { url: input.url }; data.enabled = true; }
    if (events !== undefined) data.subscribedEvents = events;
    await prisma.integrationConnection.update({ where: { id: existing.id }, data });
    return;
  }

  if (!input.url) throw new Error("A URL is required to create a connection");
  await prisma.integrationConnection.create({
    data: {
      accountId,
      provider,
      enabled: true,
      config: { url: input.url },
      subscribedEvents: events ?? CANONICAL_EVENTS,
    },
  });
}

export async function removeConnection(accountId: string, provider: UrlProvider): Promise<void> {
  await prisma.integrationConnection.deleteMany({ where: { accountId, provider } });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- manageConnections`
Expected: PASS, 7 tests.

- [ ] **Step 5: tsc gate + commit**

Run: `npx tsc --noEmit 2>&1 | grep "manageConnections"` → no lines (add explicit annotations if the Prisma `findMany`/`include` result trips inference).
```bash
git add src/lib/integrations/manageConnections.ts src/lib/integrations/manageConnections.test.ts
git commit -m "feat: generic URL-provider connection management"
```

---

## Task 8: Generic connections API route

**Files:**
- Create: `apps/web/src/app/api/integrations/connections/route.ts`

Match the fork's route conventions — READ `apps/web/src/app/api/account/webhook/route.ts` first for the exact `auth()` + `getOrCreateAccount()` usage and `Response.json` style.

- [ ] **Step 1: Read the reference route**

Open `apps/web/src/app/api/account/webhook/route.ts` and mirror its `const { userId } = await auth(); if (!userId) return 401;` guard and `const account = await getOrCreateAccount();` usage.

- [ ] **Step 2: Implement the route**

```ts
import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { isUrlProvider, listConnectionViews, saveConnection, removeConnection } from "@/lib/integrations/manageConnections";

// GET /api/integrations/connections — state for the six URL-based providers.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const account = await getOrCreateAccount();
  return Response.json({ connections: await listConnectionViews(account.id) });
}

// PATCH /api/integrations/connections — body: { provider, url?, subscribedEvents? }
export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    provider?: string; url?: string; subscribedEvents?: string[];
  };
  if (!isUrlProvider(body.provider)) return Response.json({ error: "Unknown integration" }, { status: 400 });

  const account = await getOrCreateAccount();
  try {
    await saveConnection(account.id, body.provider, { url: body.url?.trim(), subscribedEvents: body.subscribedEvents });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Failed to save" }, { status: 400 });
  }
  return Response.json({ connections: await listConnectionViews(account.id) });
}

// DELETE /api/integrations/connections — body: { provider }
export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { provider?: string };
  if (!isUrlProvider(body.provider)) return Response.json({ error: "Unknown integration" }, { status: 400 });

  const account = await getOrCreateAccount();
  await removeConnection(account.id, body.provider);
  return Response.json({ connections: await listConnectionViews(account.id) });
}
```

- [ ] **Step 3: Verify build gates + commit**

Run: `npm test` (full suite still green — no test targets this route directly; its logic is covered by `manageConnections.test.ts`).
Run: `npx tsc --noEmit 2>&1 | grep -E "integrations/connections/route"` → no lines.
```bash
git add src/app/api/integrations/connections/route.ts
git commit -m "feat: generic integrations connections API"
```

---

## Task 9: Reusable provider card component

**Files:**
- Create: `apps/web/src/components/integrations/ProviderWebhookCard.tsx`

A client component for one URL-based provider: paste URL → Connect, per-event toggles, status badge, last-delivery line, Disconnect. Mirrors the visual style of the existing `WebhookCard` in `integrations/page.tsx` (reuse the same `var(--color-*)` classes).

- [ ] **Step 1: Implement the component**

```tsx
"use client";

import { useState } from "react";

export interface ProviderCardProps {
  provider: string;
  name: string;
  category: string;
  docsUrl?: string;
  icon: React.ReactNode;
  urlLabel: string;      // e.g. "Zapier Catch Hook URL"
  urlPlaceholder: string;
  // Initial state from GET /api/integrations/connections
  initialUrl: string | null;
  initialEvents: string[];
  initialLastDelivery: { status: string; at: string } | null;
}

const EVENT_OPTIONS = [
  { id: "lead.captured", label: "Lead captured" },
  { id: "variant.winner_declared", label: "Winner declared" },
];

export function ProviderWebhookCard(props: ProviderCardProps) {
  const [url, setUrl] = useState(props.initialUrl ?? "");
  const [connected, setConnected] = useState(Boolean(props.initialUrl));
  const [events, setEvents] = useState<string[]>(
    props.initialEvents.length ? props.initialEvents : ["lead.captured", "variant.winner_declared"],
  );
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastDelivery = props.initialLastDelivery;

  function toggleEvent(id: string) {
    setEvents((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  }

  async function save() {
    if (!url.trim().startsWith("https://")) { setError("URL must start with https://"); return; }
    if (events.length === 0) { setError("Select at least one event."); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/integrations/connections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: props.provider, url: url.trim(), subscribedEvents: events }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save."); return; }
      setConnected(true); setEditing(false);
    } catch { setError("Network error."); } finally { setSaving(false); }
  }

  async function disconnect() {
    setSaving(true);
    try {
      await fetch("/api/integrations/connections", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: props.provider }),
      });
    } catch { /* best effort */ } finally { setSaving(false); }
    setConnected(false); setUrl(""); setEditing(false); setError(null);
  }

  const showForm = editing || !connected;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="shrink-0">{props.icon}</div>
          <div>
            <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">{props.name}</p>
            <p className="text-xs text-[color:var(--color-text-secondary)]">{props.category}</p>
          </div>
        </div>
        <span className={connected
          ? "inline-flex items-center gap-1 rounded-full bg-[color:var(--color-success-bg)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--color-success)]"
          : "rounded-full bg-[color:var(--color-neutral-badge)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--color-text-secondary)]"}>
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>

      {connected && !editing && (
        <div className="flex flex-col gap-1">
          <p className="break-all font-mono text-xs text-[color:var(--color-text-primary)]">{url}</p>
          <p className="text-xs text-[color:var(--color-text-secondary)]">
            Fires on: {events.map((e) => EVENT_OPTIONS.find((o) => o.id === e)?.label).filter(Boolean).join(", ")}
          </p>
          {lastDelivery && (
            <p className="text-xs text-[color:var(--color-text-secondary)]">
              Last delivery: {lastDelivery.status} · {new Date(lastDelivery.at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {showForm && (
        <div className="flex flex-col gap-3">
          <label className="text-xs font-medium text-[color:var(--color-text-primary)]">{props.urlLabel}</label>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={props.urlPlaceholder}
            className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm font-mono outline-none focus:border-[color:var(--color-primary)]" />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[color:var(--color-text-primary)]">Send on</span>
            {EVENT_OPTIONS.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-xs text-[color:var(--color-text-secondary)]">
                <input type="checkbox" checked={events.includes(o.id)} onChange={() => toggleEvent(o.id)} />
                {o.label}
              </label>
            ))}
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}

      <div className="flex items-center gap-2">
        {showForm ? (
          <button onClick={save} disabled={saving}
            className="rounded-lg border border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)] px-4 py-2 text-sm font-medium text-[color:var(--color-primary)] hover:bg-[color:var(--color-primary)] hover:text-white disabled:opacity-50 cursor-pointer">
            {saving ? "Saving..." : "Save connection"}
          </button>
        ) : (
          <>
            <button onClick={() => setEditing(true)} disabled={saving}
              className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-primary)] hover:border-[color:var(--color-primary)] cursor-pointer disabled:opacity-50">Edit</button>
            <button onClick={disconnect} disabled={saving}
              className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-secondary)] hover:text-red-500 hover:border-red-200 cursor-pointer disabled:opacity-50">
              {saving ? "..." : "Disconnect"}</button>
          </>
        )}
        {props.docsUrl && (
          <a href={props.docsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[color:var(--color-primary)] hover:underline">Docs</a>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: tsc gate + commit**

Run: `npx tsc --noEmit 2>&1 | grep "ProviderWebhookCard"` → no lines.
```bash
git add src/components/integrations/ProviderWebhookCard.tsx
git commit -m "feat: reusable provider webhook card component"
```

---

## Task 10: Wire the 6 cards into the Integrations page

**Files:**
- Modify: `apps/web/src/app/(dashboard)/integrations/page.tsx`

- [ ] **Step 1: Fetch connection state and render the six cards**

At the top of the existing default-export `IntegrationsPage` component (which is already `"use client"`), add state + a fetch on mount, and render an "Automation" and a "Notifications" section of `ProviderWebhookCard`s above the existing Webhooks card. Add this block:

```tsx
import { useState, useEffect } from "react";
import { ProviderWebhookCard, type ProviderCardProps } from "@/components/integrations/ProviderWebhookCard";

type ConnState = { provider: string; connected: boolean; url: string | null; subscribedEvents: string[]; lastDelivery: { status: string; at: string } | null };

// Static metadata for the six URL-based providers (icons reuse the simple SVG style already in this file).
const PROVIDER_META: Array<Omit<ProviderCardProps, "initialUrl" | "initialEvents" | "initialLastDelivery"> & { group: "Automation" | "Notifications" }> = [
  { provider: "zapier", name: "Zapier", category: "Automation", group: "Automation", docsUrl: "https://zapier.com/apps/webhook/integrations", urlLabel: "Zapier Catch Hook URL", urlPlaceholder: "https://hooks.zapier.com/hooks/catch/...", icon: <svg viewBox="0 0 40 40" width="28" height="28"><rect width="40" height="40" rx="8" fill="#FF4A00"/><text x="10" y="27" fontSize="18" fontWeight="bold" fill="#fff">Z</text></svg> },
  { provider: "make", name: "Make", category: "Automation", group: "Automation", docsUrl: "https://www.make.com/en/help/tools/webhooks", urlLabel: "Make Custom Webhook URL", urlPlaceholder: "https://hook.eu1.make.com/...", icon: <svg viewBox="0 0 40 40" width="28" height="28"><rect width="40" height="40" rx="8" fill="#6D00CC"/><text x="8" y="27" fontSize="18" fontWeight="bold" fill="#fff">M</text></svg> },
  { provider: "n8n", name: "n8n", category: "Automation", group: "Automation", docsUrl: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/", urlLabel: "n8n Webhook URL", urlPlaceholder: "https://<your-n8n>/webhook/...", icon: <svg viewBox="0 0 40 40" width="28" height="28"><rect width="40" height="40" rx="8" fill="#EA4B71"/><text x="10" y="27" fontSize="16" fontWeight="bold" fill="#fff">n8</text></svg> },
  { provider: "slack", name: "Slack", category: "Notifications", group: "Notifications", docsUrl: "https://api.slack.com/messaging/webhooks", urlLabel: "Slack Incoming Webhook URL", urlPlaceholder: "https://hooks.slack.com/services/...", icon: <svg viewBox="0 0 40 40" width="28" height="28"><rect width="40" height="40" rx="8" fill="#4A154B"/><text x="10" y="27" fontSize="18" fontWeight="bold" fill="#fff">S</text></svg> },
  { provider: "discord", name: "Discord", category: "Notifications", group: "Notifications", docsUrl: "https://support.discord.com/hc/en-us/articles/228383668", urlLabel: "Discord Channel Webhook URL", urlPlaceholder: "https://discord.com/api/webhooks/...", icon: <svg viewBox="0 0 40 40" width="28" height="28"><rect width="40" height="40" rx="8" fill="#5865F2"/><text x="10" y="27" fontSize="18" fontWeight="bold" fill="#fff">D</text></svg> },
  { provider: "teams", name: "Microsoft Teams", category: "Notifications", group: "Notifications", docsUrl: "https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook", urlLabel: "Teams Incoming Webhook URL", urlPlaceholder: "https://outlook.office.com/webhook/...", icon: <svg viewBox="0 0 40 40" width="28" height="28"><rect width="40" height="40" rx="8" fill="#4B53BC"/><text x="10" y="27" fontSize="18" fontWeight="bold" fill="#fff">T</text></svg> },
];
```

Inside the component body, add:
```tsx
  const [conns, setConns] = useState<ConnState[] | null>(null);
  useEffect(() => {
    fetch("/api/integrations/connections").then((r) => r.json())
      .then((d: { connections: ConnState[] }) => setConns(d.connections))
      .catch(() => setConns([]));
  }, []);
```

And in the returned JSX, before the existing category sections, render:
```tsx
      {(["Automation", "Notifications"] as const).map((group) => (
        <section key={group}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">{group}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PROVIDER_META.filter((m) => m.group === group).map((m) => {
              const c = conns?.find((x) => x.provider === m.provider);
              return (
                <ProviderWebhookCard key={m.provider} {...m}
                  initialUrl={c?.url ?? null}
                  initialEvents={c?.subscribedEvents ?? []}
                  initialLastDelivery={c?.lastDelivery ?? null} />
              );
            })}
          </div>
        </section>
      ))}
```

Keep the existing Webhooks card section as-is (it remains its own card backed by `/api/account/webhook`).

- [ ] **Step 2: Verify build + tsc**

Run: `npm test` (full suite still green) and `npx tsc --noEmit 2>&1 | grep "integrations/page"` → no lines.

- [ ] **Step 3: Manual verification (dev server)**

Start the app (`npm run dev` from `apps/web`), open the Integrations tab, and confirm: 6 new cards render in Automation/Notifications groups; pasting a test URL (use a requestbin) + choosing events + Save shows "Connected"; a captured test lead / declared winner delivers to the URL; Edit/Disconnect work; reloading preserves state. Record the requestbin hit as evidence.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/integrations/page.tsx
git commit -m "feat: Zapier/Make/n8n/Slack/Discord/Teams cards on Integrations tab"
```

---

## Phase 1 Definition of Done

- [ ] `npm test` — all suites pass (Phase 0's 33 + the new adapter/manage tests).
- [ ] `npx tsc --noEmit` — no NEW errors reference any Phase 1 file (baseline stays ~143).
- [ ] All 6 providers resolve via `getAdapter` and deliver on `lead.captured` / `variant.winner_declared` per their subscribed events.
- [ ] Manual: connect each of the 6 to a test URL, fire a lead + a winner, confirm delivery + correct formatting (raw envelope for Zapier/Make/n8n; readable message for Slack/Discord/Teams).
- [ ] Existing Webhooks card still works (Phase 0 regression check).

---

## Self-Review (completed by plan author)

**Spec coverage (Phase 1 scope):**
- Automation group Zapier/Make/n8n (§1, §7 webhook adapters) → Tasks 1, 3. Notification group Slack/Discord/Teams with channel formatting (§7) → Tasks 2, 4, 5, 6. Per-event toggles (§9) → Tasks 7 (subscribedEvents) + 9/10 (UI). Connect flow + status + last delivery (§9) → Tasks 7 (views/lastDelivery), 9, 10. Reliability/retries reused from Phase 0 pipeline (no new work). Provider enum already present (Phase 0) — no migration.
- Deferred by design: Klaviyo/Mailchimp/HubSpot (Phase 2), Mailgun/Twilio + templates (Phase 3), consent gating (Phase 2), full visual redesign.

**Placeholder scan:** No TBD/TODO. Every code step is complete. Task 8/10 reference reading a sibling route/existing page first — the source is pinned and reading is a required prior step, so no invented APIs.

**Type consistency:** `postWebhook`/`classifyStatus` (Task 1) used identically in Tasks 3–6. `summarizeEvent`→`EventSummary` (Task 2) consumed in 4/5/6. `ConnectionView`, `isUrlProvider`, `saveConnection`, `removeConnection`, `listConnectionViews` (Task 7) match their API (Task 8) and UI (Tasks 9/10) call sites. Provider ids (`zapier/make/n8n/slack/discord/teams`) are consistent across adapters, registry, `URL_PROVIDERS`, and `PROVIDER_META`. Event ids (`lead.captured`, `variant.winner_declared`) match `CANONICAL_EVENTS` and the UI `EVENT_OPTIONS`.

---

## Execution Handoff

Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.
2. **Inline Execution** — execute here with checkpoints.

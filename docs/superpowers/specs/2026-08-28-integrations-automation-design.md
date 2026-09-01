# Integrations & Automation Engine — Design Spec

**Date:** 2026-08-28
**Status:** Approved (design), pending implementation plan
**Branch:** `feat/integrations-automation-engine`

## 1. Goal

Turn the Integrations tab from one live card (Webhooks) plus four disabled facades
into **11 fully working, event-driven integrations**, all configurable per merchant:

| Group | Providers | Merchant supplies | What it does |
|---|---|---|---|
| Automation | Zapier, Make, n8n | A webhook URL | Fires signed event payloads |
| Notifications | Slack, Discord, Microsoft Teams | A webhook URL | Posts a formatted message |
| Marketing sync | Klaviyo, Mailchimp, HubSpot | An API key/token | Upserts the lead into a list/CRM |
| Messaging | Mailgun, Twilio | An API key/token + templates | Sends email / SMS on configured events |

None of these require app registration or review on Asmos's side — every credential
is self-served by the merchant in their own provider account. The existing first-class
Shopify OAuth app is out of scope here.

## 2. Non-goals (YAGNI)

- No visual flow-builder / branching automations. The messaging engine is
  `event → optional delay → template`, nothing more in v1.
- No official published Zapier/Slack marketplace apps (those need review; the
  webhook path gives the same value with zero registration).
- No Google / Meta / Salesforce (OAuth + review — separate future work).
- No per-field custom mapping UI for sync providers in v1 — a sensible fixed
  mapping (email/name/phone/tags) with the option to add later.

## 3. The core decision: unified event bus + adapters

Rejected: bespoke code per integration (unmaintainable by the 11th).

**Chosen:** one event bus and one delivery pipeline; each integration is a small
**adapter**. Adding integration #12 later means writing one adapter file.

Deliveries run through **Inngest** (already in the stack), which gives us
**automatic retries, durable delays, and concurrency control** — a strict upgrade
over today's fire-and-forget `dispatchWebhook`, which has no retries.

```
lead.captured / variant.winner_declared / gift.claimed
        │
        ▼
emitIntegrationEvent(accountId, event)          ← replaces direct dispatchWebhook calls
        │  loads enabled connections subscribed to this event
        ▼
inngest.send("integration/deliver", { connectionId, event })   (one per connection)
        │
        ▼
Inngest fn "integration-deliver"  ── retries, step.sleep for delays
        │  looks up adapter by provider
        ▼
adapter.deliver(event, connection) ──► provider HTTP API
        │
        ▼
IntegrationDelivery row (status, error, timestamp)
```

## 4. Event taxonomy

Canonical, semantic events (not the noisy raw widget events like IMPRESSION):

| Event | Source today | Payload highlights |
|---|---|---|
| `lead.captured` | `api/widget/leads/route.ts` | email, name, phone, consent, campaign/variant, reward coupon |
| `variant.winner_declared` | `api/campaigns/[id]/route.ts` | campaign, winning variant, declared_at |
| `gift.claimed` *(new)* | widget leads route (when `rewardClaimedCode` set) | lead + reward code — enables follow-up sends |

Each connection stores a `subscribedEvents: string[]`. The Integrations UI exposes
per-event toggles per card. `gift.claimed` is added because it is a meaningful
marketing trigger ("they claimed the coupon — send a reminder to use it") and is
cheap given the data already exists on `Lead.rewardClaimedCode`.

## 5. Data model

### 5.1 New: `IntegrationConnection`

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

  provider  IntegrationProvider
  enabled   Boolean  @default(true)

  // Non-secret config: endpoint URL, list id, from-address, sender id, etc.
  config    Json     @default("{}")

  // AES-256-GCM encrypted secret bundle (api key, webhook signing secret, auth token).
  // Never returned to the client in plaintext — only a masked hint.
  credentials Json?

  // Which canonical events fire this connection.
  subscribedEvents String[] @default([])

  // Messaging providers (mailgun/twilio) only: array of { event, delayMinutes, templateId }.
  // Stored here (not a separate table) to keep v1 simple; promote to a table if it grows.
  rules     Json     @default("[]")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  deliveries IntegrationDelivery[]
  templates  MessageTemplate[]

  @@index([accountId, provider])
}
```

A single account may have **multiple connections of the same provider** later
(e.g. two Slack channels), so provider is not unique per account.

### 5.2 New: `MessageTemplate` (Mailgun/Twilio)

```prisma
model MessageTemplate {
  id           String  @id @default(cuid())
  connectionId String
  connection   IntegrationConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)

  name    String
  channel String            // "email" | "sms"
  subject String?           // email only
  body    String  @db.Text  // supports {{lead.name}}, {{reward.coupon_code}}, ...

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([connectionId])
}
```

### 5.3 New: `IntegrationDelivery` (observability)

```prisma
model IntegrationDelivery {
  id           String  @id @default(cuid())
  connectionId String
  connection   IntegrationConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)

  event     String
  status    String   // "success" | "failed" | "skipped"
  detail    String?  @db.Text   // error text, or "skipped: no consent"
  createdAt DateTime @default(now())

  @@index([connectionId, createdAt])
}
```

Retention: a periodic Inngest cron prunes rows older than 30 days (reuse the
existing `sweepStaleCampaigns` cron pattern).

### 5.4 Migration from existing fields

- `Account.webhookUrl / webhookSecret / webhookEnabled` → a `webhooks`
  `IntegrationConnection` (url in `config`, secret encrypted into `credentials`,
  `enabled` from `webhookEnabled`, `subscribedEvents` defaulting to both existing events).
- `Account.integrationCredentials` JSON → one **sync** connection each for
  `klaviyo/mailchimp/hubspot`, credentials **re-encrypted** (they are plaintext today).
  Any stored `zapier` facade key is **discarded**, not migrated: in the new model
  Zapier is a URL-based webhook adapter, so the old API-key facade (which never
  actually forwarded anything) has no functional target. Affected merchants simply
  reconnect Zapier via URL — acceptable because the facade was a no-op.
- Old columns kept for one release (dual-read) then dropped in a follow-up migration,
  so a rollback mid-deploy doesn't lose data.
- `/api/account/webhook` remains as a thin compatibility shim over the new model
  until the UI fully migrates, then is removed.

## 6. Security

1. **Encryption at rest.** All secrets go through `lib/integrations/crypto.ts`
   (AES-256-GCM, key from `INTEGRATION_ENCRYPTION_KEY` env, per-record random IV,
   auth tag stored alongside). Today's plaintext storage is treated as a defect
   this work fixes. Decryption happens only server-side inside adapters.
2. **Masked reads.** GET endpoints return `••••••1234`, never the secret.
3. **Consent gating.** Lead-directed adapters (klaviyo, mailchimp, hubspot,
   mailgun, twilio) skip any lead with `consentGiven = false`, logged as
   `status: "skipped"`. Default on; a per-connection `ignoreConsent` override
   exists but is off by default. Rationale: GDPR / CAN-SPAM / TCPA — Twilio SMS in
   particular is TCPA-sensitive. Notification/automation adapters (slack/discord/
   teams/zapier/make/n8n) are merchant-internal and not consent-gated.
4. **SSRF guard.** Webhook URLs must be `https://` and are rejected if they resolve
   to private/loopback ranges (extends the current https-only check).

## 7. Adapter interface

```ts
// lib/integrations/types.ts
export interface IntegrationAdapter {
  provider: IntegrationProvider;
  kind: "webhook" | "sync" | "messaging";

  // Validate on connect (test the credential / URL). Returns ok or a user-facing error.
  validate(input: { config: Config; credentials: Secrets }): Promise<ValidationResult>;

  // Deliver one event. MUST be idempotent-safe and never throw for provider errors —
  // returns a DeliveryResult the pipeline logs. Throwing is reserved for
  // retriable infra errors so Inngest retries.
  deliver(ctx: DeliverContext): Promise<DeliveryResult>;
}
```

Registry: `lib/integrations/registry.ts` maps `provider → adapter`. The Inngest
delivery function and the connect/validate API both resolve adapters through it.

### Per-adapter behaviour

- **webhook/notification (zapier, make, n8n, slack, discord, teams):** build a
  payload and POST to `config.url`. Zapier/Make/n8n reuse the existing JSON
  envelope from `lib/webhook.ts` but deliver it unsigned (HMAC signing is
  currently only exposed on the native Webhooks adapter where a secret field exists,
  though the adapter code is forward-looking). Slack/Discord/Teams format a channel-native
  message (Slack blocks, Discord embed, Teams MessageCard) — e.g.
  "🎉 New lead: jane@x.com from *Summer Popup* · coupon SAVE10".
- **sync (klaviyo, mailchimp, hubspot):** on `lead.captured`/`gift.claimed`, upsert
  the contact (email primary, name/phone, tag with campaign name) into the list/CRM
  identified in `config` (e.g. Mailchimp `audienceId`, Klaviyo `listId`).
- **messaging (mailgun, twilio):** evaluate the connection's `rules` for the event;
  for each matching rule, render its template with the lead payload and send
  (Mailgun email / Twilio SMS). Delays handled by the pipeline (§8).

## 8. Messaging rules engine ("what to send and when")

A `rule` = `{ event: string; delayMinutes: number; templateId: string }`.

Flow inside the Inngest delivery function for a messaging connection:

1. Filter `connection.rules` to those matching the event.
2. For each rule: if `delayMinutes > 0`, `await step.sleep(...)` (durable — survives
   restarts, no cron needed). Then re-check the lead still qualifies (still consented,
   not unsubscribed) and send via the adapter.
3. Log an `IntegrationDelivery` per send.

Template variables available: `{{lead.name}}`, `{{lead.email}}`, `{{lead.phone}}`,
`{{reward.coupon_code}}`, `{{reward.label}}`, `{{campaign.name}}`, `{{variant.name}}`.
Rendering is a small, escaped `{{path}}` substitution (`lib/integrations/template.ts`) —
no arbitrary code, unknown vars render empty.

## 9. UI / UX

Integrations tab reorganised into the four groups from §1 (plus the migrated
Webhooks card). Reuses existing card styling, `PageHeader`, and design tokens.

Each card:
- Connect flow: paste a URL (webhook/notification) or key (sync/messaging), with a
  **Validate** step that calls `adapter.validate` and shows success/error inline.
- **Per-event toggles** ("Fire on: ☑ Lead captured ☑ Winner declared ☐ Gift claimed").
- Status badge + **last delivery** line ("✓ delivered 2m ago" / "✕ failed — 401").
- Docs link with provider-specific setup instructions.

Messaging cards (Mailgun/Twilio) additionally open a **rules dashboard**:
- List of rules (event · delay · template).
- Add/edit rule: event dropdown, delay input, template editor (subject for email +
  body) with a clickable variable palette and a **Send test** button (renders with
  sample data and sends to a merchant-entered address/number).

## 10. Error handling & reliability

- Inngest retries failed deliveries with backoff (default policy); terminal failure
  after the configured max attempts → `status: "failed"` delivery row.
- Adapter provider errors (4xx/5xx) are classified: auth/validation errors are
  non-retriable (fail fast, surface to merchant); network/5xx/429 are retriable.
- Emission is decoupled from request latency — `emitIntegrationEvent` only enqueues;
  it never blocks the widget/campaign response (keeps today's `after()` behaviour).

## 11. Testing (TDD)

- **Unit per adapter:** payload/message formatting, sync mapping, template
  rendering, consent gating — provider HTTP mocked. Write tests first.
- **crypto.ts:** round-trip encrypt/decrypt, tamper detection (auth tag), key-missing error.
- **template.ts:** variable substitution, unknown vars, escaping.
- **Pipeline integration test:** `emitIntegrationEvent` → correct Inngest sends →
  delivery function dispatches to the right adapters and writes delivery rows;
  consent-skip path.
- **Migration test:** existing webhook + integrationCredentials rows map correctly
  and secrets are re-encrypted.

## 12. Build phases (each shipped + verified before the next)

- **Phase 0 — Foundation:** Prisma models + migration (incl. data migration from
  existing fields), `crypto.ts`, `template.ts`, adapter interface + registry,
  `emitIntegrationEvent`, Inngest `integration-deliver` function, delivery log +
  prune cron. Re-point the two existing emission sites
  (`api/widget/leads`, `api/campaigns/[id]`) at the new bus. Migrate the Webhooks card.
- **Phase 1 — Automation + Notifications (6):** zapier, make, n8n, slack, discord,
  teams adapters + cards + per-event toggles. Fully self-verifiable (no external keys).
- **Phase 2 — Marketing sync (3):** klaviyo, mailchimp, hubspot adapters + cards +
  consent gating. Verified against provider sandboxes (needs one test key each, or
  first live merchant).
- **Phase 3 — Messaging engine (2):** mailgun, twilio adapters + rules dashboard +
  template editor + durable delays + test-send.

## 13. Decisions made on the user's behalf (delegated: "trust your instincts / best UX practices")

1. Unified event bus + adapter registry on Inngest (vs bespoke per-integration).
2. Encrypt credentials at rest — fixes existing plaintext storage.
3. Consent-gate all lead-directed sends by default.
4. Added `gift.claimed` as a third configurable event (cheap, high marketing value).
5. Rules engine limited to `event → delay → template` (no branching) for v1.
6. Delivery log surfaced in the UI so integrations visibly work.

## 14. Open items to confirm during planning

- Exact Inngest retry counts / backoff per adapter kind.
- Whether to keep `/api/account/webhook` shim for one release or cut over immediately.
- Sync provider default field mapping specifics (tags, list targeting per provider).

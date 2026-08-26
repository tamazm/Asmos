import crypto from "crypto";

// ── Event type union ────────────────────────────────────────────────────────

export type WebhookEvent =
  | { event: "lead.captured"; payload: LeadCapturedPayload }
  | { event: "variant.winner_declared"; payload: VariantWinnerPayload };

// ── Payload shapes ──────────────────────────────────────────────────────────

export type LeadCapturedPayload = {
  campaign_id: string;
  campaign_name: string;
  variant_id: string;
  variant_name: string;
  lead: {
    email: string | null;
    name: string | null;
    phone: string | null;
    consent_given: boolean;
    captured_at: string; // ISO 8601
  };
  reward: {
    label: string;
    type: string;
    coupon_code: string | null;
  } | null;
};

export type VariantWinnerPayload = {
  campaign_id: string;
  campaign_name: string;
  winning_variant_id: string;
  winning_variant_name: string;
  declared_at: string; // ISO 8601
};

// ── Dispatch ────────────────────────────────────────────────────────────────

/**
 * Fire-and-forget outbound webhook delivery.
 *
 * Design decisions:
 * - HTTPS-only enforcement is handled at save time (/api/account/webhook).
 * - HMAC-SHA256 signature matches Stripe/GitHub convention: `sha256=<hex>`.
 * - 10 s timeout; failures are logged but never thrown - callers use after().
 * - No retries in v1 - keeps it simple; retry queue is a future feature.
 */
export async function dispatchWebhook(
  url: string,
  secret: string | null,
  body: WebhookEvent,
): Promise<void> {
  const payload = JSON.stringify(body);
  const timestamp = String(Date.now());

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Asmos-Webhook/1.0",
    "X-Asmos-Event": body.event,
    "X-Asmos-Timestamp": timestamp,
  };

  if (secret) {
    const sig = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
    headers["X-Asmos-Signature"] = `sha256=${sig}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: payload,
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`[webhook] delivery failed: ${res.status} ${res.statusText} → ${url}`);
    }
  } catch (err) {
    console.error(`[webhook] dispatch error → ${url}:`, err);
  } finally {
    clearTimeout(timeout);
  }
}

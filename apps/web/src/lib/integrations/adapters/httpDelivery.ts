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

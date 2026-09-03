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

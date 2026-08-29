import { encryptSecret, decryptSecret } from "@/lib/crypto";

// A short-lived, tamper-proof token that proves "the bearer controls shop X's
// embedded admin". It's minted server-side ONLY after verifying the App Bridge
// session token (so it can't be forged for someone else's shop), handed to the
// browser, and carried through the top-frame connect redirect to app.asmos.io.
// There, /api/shopify/connect verifies it to know which shop is being linked —
// the other half of the proof is the Clerk sign-in on that page (ownership of
// the Asmos account). Both halves are required to link.
//
// Built on the existing AES-256-GCM secret box: authenticated encryption gives
// us integrity (tampering fails to decrypt) and confidentiality for free, so no
// separate HMAC scheme is needed.

const TTL_MS = 10 * 60 * 1000; // 10 minutes — long enough to sign in, short enough to limit replay.

interface LinkTokenPayload {
  shopDomain: string;
  // The shop's account id at mint time. Linking re-points the shop to a new
  // account, so a replayed token no longer matches — that's what makes the
  // token effectively single-use (see linkShopToAccount's fromAccountId check).
  fromAccountId: string;
  exp: number; // epoch ms
}

export function createLinkToken(shopDomain: string, fromAccountId: string): string {
  const payload: LinkTokenPayload = { shopDomain, fromAccountId, exp: Date.now() + TTL_MS };
  return encryptSecret(JSON.stringify(payload));
}

export class InvalidLinkTokenError extends Error {}

// Returns the shop domain + minted-at account the token authorizes, or throws
// InvalidLinkTokenError if it's malformed, tampered, or expired.
export function verifyLinkToken(token: string): { shopDomain: string; fromAccountId: string } {
  let payload: LinkTokenPayload;
  try {
    payload = JSON.parse(decryptSecret(token)) as LinkTokenPayload;
  } catch {
    throw new InvalidLinkTokenError("This connection link is invalid.");
  }
  if (!payload.shopDomain || !payload.fromAccountId || typeof payload.exp !== "number") {
    throw new InvalidLinkTokenError("This connection link is invalid.");
  }
  if (Date.now() > payload.exp) {
    throw new InvalidLinkTokenError("This connection link has expired. Please start again from the app.");
  }
  return { shopDomain: payload.shopDomain, fromAccountId: payload.fromAccountId };
}

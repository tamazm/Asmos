import { createHmac, timingSafeEqual } from "crypto";

// A short-lived, signed first-party session for an embedded Shopify merchant.
// Set after token exchange (/api/shopify/session) so subsequent embedded
// requests resolve to the shop's Account without a Clerk sign-in. This is the
// Shopify-side analog of Clerk's session cookie (see src/lib/account.ts).
//
// Embedded apps run in a cross-site iframe (admin.shopify.com framing
// app.asmos.io), so the cookie is SameSite=None; Secure and Partitioned
// (CHIPS) to survive third-party-cookie restrictions. Because that survival is
// browser-dependent, callers should also accept a valid App Bridge session
// token as a fallback — see getEmbeddedAccount() in embeddedAuth.ts.

const COOKIE_NAME = "asmos_shop_session";
const MAX_AGE_SECONDS = 60 * 60 * 24; // 24h

export const SHOP_SESSION_COOKIE = COOKIE_NAME;
export const SHOP_SESSION_MAX_AGE = MAX_AGE_SECONDS;

export type ShopSession = { shopDomain: string; accountId: string };

function signingKey(): string {
  const key = process.env.SHOPIFY_API_SECRET;
  if (!key) throw new Error("SHOPIFY_API_SECRET is not set");
  return key;
}

function sign(payloadB64: string): string {
  return createHmac("sha256", signingKey()).update(payloadB64).digest("base64url");
}

// value = base64url(JSON{ shopDomain, accountId, exp }) + "." + HMAC-SHA256
export function encodeShopSession(session: ShopSession): string {
  const payload = { ...session, exp: Date.now() + MAX_AGE_SECONDS * 1000 };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function decodeShopSession(value: string | undefined | null): ShopSession | null {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = value.slice(0, dot);
  const sig = value.slice(dot + 1);

  // Constant-time signature check — reject anything not signed by us.
  const expected = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (!payload.shopDomain || !payload.accountId) return null;
    return { shopDomain: String(payload.shopDomain), accountId: String(payload.accountId) };
  } catch {
    return null;
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "none" as const,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
    // CHIPS — partition to the top-level site so the cookie survives inside
    // the third-party Shopify admin iframe under Chrome's cookie phase-out.
    partitioned: true,
  };
}

// next/headers is imported lazily so this module's pure encode/decode can be
// used (and unit-checked) outside a Next request scope.
export async function setShopSessionCookie(session: ShopSession): Promise<void> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  // partitioned isn't in every ResponseCookie type yet; harmless if ignored.
  store.set(COOKIE_NAME, encodeShopSession(session), cookieOptions() as never);
}

export async function readShopSessionFromCookies(): Promise<ShopSession | null> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return decodeShopSession(store.get(COOKIE_NAME)?.value);
}

export async function clearShopSessionCookie(): Promise<void> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.set(COOKIE_NAME, "", { ...cookieOptions(), maxAge: 0 } as never);
}

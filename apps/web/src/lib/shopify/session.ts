import { shopify } from "./client";

export class InvalidSessionTokenError extends Error {}

// Verifies the App Bridge session token every embedded-admin request must
// carry as `Authorization: Bearer <token>`. Throws InvalidSessionTokenError
// on anything missing/malformed/expired - callers turn that into a 401.
export async function verifySessionToken(request: Request): Promise<{ shopDomain: string }> {
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const token = authHeader?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new InvalidSessionTokenError("Missing Authorization: Bearer <session token>");

  let payload;
  try {
    payload = await shopify.session.decodeSessionToken(token);
  } catch (err) {
    throw new InvalidSessionTokenError(`Invalid session token: ${(err as Error).message}`);
  }

  // `dest` is the shop's admin origin, e.g. "https://example.myshopify.com"
  const shopDomain = payload.dest.replace(/^https?:\/\//, "");
  return { shopDomain };
}

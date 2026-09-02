import crypto from "crypto";

const STATE_TTL_SECONDS = 10 * 60;

function getStateSecret(): string {
  const secret =
    process.env.INTEGRATION_OAUTH_STATE_SECRET ||
    process.env.INTEGRATION_ENCRYPTION_KEY ||
    process.env.CLERK_SECRET_KEY ||
    "asmos-oauth-secret-fallback-key-32b";
  return secret;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getStateSecret()).update(value).digest("base64url");
}

export function createOAuthState(accountId: string): string {
  const payload = Buffer.from(JSON.stringify({
    accountId,
    expiresAt: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
    nonce: crypto.randomBytes(16).toString("hex"),
  })).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export function verifyOAuthState(state: string): { accountId: string } | null {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = sign(payload);
  if (signature.length !== expectedSignature.length || !crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  )) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      accountId?: string;
      expiresAt?: number;
    };

    if (!parsed.accountId || !parsed.expiresAt || parsed.expiresAt < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return { accountId: parsed.accountId };
  } catch {
    return null;
  }
}

export function getMailchimpRedirectUri(request: Request): string {
  return process.env.MAILCHIMP_OAUTH_REDIRECT_URI
    || new URL("/api/integrations/mailchimp/callback", request.url).toString();
}

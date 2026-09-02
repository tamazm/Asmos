import { NextResponse } from "next/server";
import { getAccountSession } from "@/lib/auth-adapter";
import { prisma } from "@/lib/prisma";
import { encryptBundle } from "@/lib/integrations/connections";
import { getMailchimpRedirectUri, verifyOAuthState } from "@/lib/integrations/oauthState";

function redirectWithError(request: Request, message: string): Response {
  const url = new URL("/integrations", request.url);
  url.searchParams.set("mailchimp", "error");
  url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request): Promise<Response> {
  const session = await getAccountSession();
  if (!session) return redirectWithError(request, "You must be signed in to connect Mailchimp.");

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) return redirectWithError(request, "Mailchimp authorization was cancelled.");
  if (!code || !state) return redirectWithError(request, "Mailchimp authorization was incomplete.");

  const verifiedState = verifyOAuthState(state);
  if (!verifiedState || verifiedState.accountId !== session.accountId) {
    return redirectWithError(request, "Mailchimp authorization could not be verified.");
  }

  const clientId = process.env.MAILCHIMP_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MAILCHIMP_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return redirectWithError(request, "Mailchimp OAuth is not configured.");
  }

  const redirectUri = getMailchimpRedirectUri(request);
  const tokenResponse = await fetch("https://login.mailchimp.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });

  if (!tokenResponse.ok) return redirectWithError(request, "Mailchimp token exchange failed.");
  const token = await tokenResponse.json() as { access_token?: string };
  if (!token.access_token) return redirectWithError(request, "Mailchimp did not return an access token.");

  const metadataResponse = await fetch("https://login.mailchimp.com/oauth2/metadata", {
    headers: { Authorization: `OAuth ${token.access_token}` },
  });
  if (!metadataResponse.ok) return redirectWithError(request, "Mailchimp account details could not be retrieved.");

  const metadata = await metadataResponse.json() as { dc?: string };
  if (!metadata.dc) return redirectWithError(request, "Mailchimp did not return a server prefix.");

  const existing = await prisma.integrationConnection.findUnique({
    where: { accountId_provider: { accountId: session.accountId, provider: "mailchimp" } },
  });

  await prisma.integrationConnection.upsert({
    where: { accountId_provider: { accountId: session.accountId, provider: "mailchimp" } },
    update: {
      enabled: true,
      credentials: encryptBundle({ accessToken: token.access_token, dataCenter: metadata.dc }),
      config: existing?.config ?? {},
      subscribedEvents: existing?.subscribedEvents ?? ["lead.captured"],
    },
    create: {
      accountId: session.accountId,
      provider: "mailchimp",
      enabled: true,
      credentials: encryptBundle({ accessToken: token.access_token, dataCenter: metadata.dc }),
      config: {},
      subscribedEvents: ["lead.captured"],
    },
  });

  const redirect = new URL("/integrations", request.url);
  redirect.searchParams.set("mailchimp", "connected");
  return NextResponse.redirect(redirect);
}

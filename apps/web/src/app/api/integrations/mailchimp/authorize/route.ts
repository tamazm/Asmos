import { getAccountSession } from "@/lib/auth-adapter";
import { createOAuthState, getMailchimpRedirectUri } from "@/lib/integrations/oauthState";

export async function GET(request: Request): Promise<Response> {
  const session = await getAccountSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.MAILCHIMP_OAUTH_CLIENT_ID;
  if (!clientId) {
    return Response.json({ error: "Mailchimp OAuth is not configured" }, { status: 503 });
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: getMailchimpRedirectUri(request),
    state: createOAuthState(session.accountId),
  });

  return Response.redirect(`https://login.mailchimp.com/oauth2/authorize?${params.toString()}`);
}

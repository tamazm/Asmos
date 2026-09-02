import { getAccountSession } from "@/lib/auth-adapter";
import { createOAuthState, getMailchimpRedirectUri } from "@/lib/integrations/oauthState";

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAccountSession();
    if (!session) {
      const url = new URL("/integrations", request.url);
      url.searchParams.set("error", "Unauthorized: please sign in to connect Mailchimp.");
      return Response.redirect(url.toString());
    }

    const clientId = process.env.MAILCHIMP_OAUTH_CLIENT_ID;
    if (!clientId) {
      const url = new URL("/integrations", request.url);
      url.searchParams.set("error", "Mailchimp OAuth client ID is not configured on the server.");
      return Response.redirect(url.toString());
    }

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: getMailchimpRedirectUri(request),
      state: createOAuthState(session.accountId),
    });

    return Response.redirect(`https://login.mailchimp.com/oauth2/authorize?${params.toString()}`);
  } catch (err: any) {
    console.error("[mailchimp authorize error]", err);
    const url = new URL("/integrations", request.url);
    url.searchParams.set("error", err?.message || "Failed to start Mailchimp authorization.");
    return Response.redirect(url.toString());
  }
}

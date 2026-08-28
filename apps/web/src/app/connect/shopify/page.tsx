import { currentUser } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { verifyLinkToken, InvalidLinkTokenError } from "@/lib/shopify/linkToken";
import { ConnectForm } from "./ConnectForm";

// app.asmos.io/connect/shopify — the top-frame landing for "connect your
// existing Asmos account" from the embedded Shopify admin. Clerk-protected by
// the middleware (see proxy.ts: /connect is a protected + app route), so an
// unauthenticated merchant is bounced through sign-in and returned here with
// the token intact. Server component: it resolves the signed-in account and its
// websites, then hands off to a client form for the pick-and-confirm step.
export default async function ConnectShopifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  let shopDomain: string | null = null;
  let tokenError: string | null = null;
  if (!token) {
    tokenError = "This page was opened without a connection link. Start again from the Asmos app in your Shopify admin.";
  } else {
    try {
      ({ shopDomain } = verifyLinkToken(token));
    } catch (err) {
      tokenError =
        err instanceof InvalidLinkTokenError
          ? err.message
          : "This connection link couldn't be verified.";
    }
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const account = await getOrCreateAccount();
  const websites = (account.websites ?? []).map((w: { id: string; url: string }) => ({ id: w.id, url: w.url }));

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f6f6f7",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "#fff",
          border: "1px solid #e3e3e3",
          borderRadius: 16,
          padding: 28,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", color: "#1a1a1a" }}>
          Connect to Asmos
        </h1>

        {tokenError ? (
          <div
            role="alert"
            style={{
              marginTop: 12,
              borderRadius: 10,
              border: "1px solid #e0b3b3",
              background: "#fff4f4",
              padding: 14,
              color: "#8a1f1f",
              fontSize: 14,
            }}
          >
            {tokenError}
          </div>
        ) : (
          <ConnectForm
            token={token!}
            shopDomain={shopDomain!}
            email={email}
            websites={websites}
          />
        )}
      </div>
    </main>
  );
}

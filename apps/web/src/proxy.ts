import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const isMockAuth = process.env.MOCK_AUTH === "true";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/campaigns(.*)",
  "/onboarding(.*)",
  "/leads(.*)",
  "/analytics(.*)",
  "/integrations(.*)",
  "/settings(.*)",
]);

// Routes that live on app.asmos.io - the actual platform, plus sign-in/up
// and invite-accept so Clerk's session cookie is always set and read on the
// same origin, plus the free tools. Everything else (marketing pages,
// /analyze, /blog) stays on the root domain.
const isAppRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/campaigns(.*)",
  "/leads(.*)",
  "/analytics(.*)",
  "/integrations(.*)",
  "/settings(.*)",
  "/admin(.*)",
  "/superadmin(.*)",
  "/reports(.*)",
  "/rewards(.*)",
  "/onboarding(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/invite(.*)",
  "/tools(.*)",
  "/store-preview(.*)",
  "/shopify-admin(.*)",
]);

const APP_HOST = process.env.NEXT_PUBLIC_APP_HOST || "app.asmos.io";
const MARKETING_HOST = process.env.NEXT_PUBLIC_MARKETING_HOST || "asmos.io";

// Splits marketing (asmos.io) from the app (app.asmos.io) by Host header -
// same Vercel project and codebase serve both, so this is the only thing
// that actually draws the line between them. Only acts on the exact
// production hosts (or the app.localhost:3000 convention for local
// testing) - any other host (bare localhost, Vercel preview URLs, custom
// domains) passes through completely untouched so local dev and previews
// keep working exactly as before.
// Built via the plain NextResponse constructor rather than
// NextResponse.redirect()/Response.redirect(): the former silently
// collapses the Location header to a same-origin relative path when the
// target host equals the dev server's own literal bind address, and the
// latter produces a Response with spec-immutable headers that throws when
// Clerk's middleware wrapper tries to attach its own headers to whatever
// this function returns.
function crossHostRedirect(url: URL): NextResponse {
  return new NextResponse(null, { status: 307, headers: { Location: url.toString() } });
}

function splitByHost(req: NextRequest): NextResponse | null {
  const host = req.headers.get("host") ?? "";
  const { pathname } = req.nextUrl;

  if (host === APP_HOST || host.startsWith("app.localhost")) {
    // Straight to sign-in, not /dashboard - the marketing landing page must
    // never be what someone sees on app.*. /sign-in already redirects an
    // already-authenticated visitor on to /dashboard itself (see
    // app/sign-in/[[...sign-in]]/page.tsx), so this is safe for both cases.
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
    if (!isAppRoute(req) && !pathname.startsWith("/api")) {
      const marketingUrl = new URL(req.url);
      marketingUrl.host = host.replace(/^app\./, "");
      return crossHostRedirect(marketingUrl);
    }
    return null;
  }

  if (host === MARKETING_HOST || host === `www.${MARKETING_HOST}`) {
    if (isAppRoute(req)) {
      const appUrl = new URL(req.url);
      appUrl.host = APP_HOST;
      return crossHostRedirect(appUrl);
    }
    return null;
  }

  return null;
}

export default isMockAuth
  ? function proxy(req: NextRequest) {
      return splitByHost(req) ?? NextResponse.next();
    }
  : clerkMiddleware(async (auth, req) => {
      const split = splitByHost(req);
      if (split) return split;
      if (isProtectedRoute(req)) {
        await auth.protect();
      }
    });

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

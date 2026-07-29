import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

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

export default isMockAuth
  ? function proxy() {
      return NextResponse.next();
    }
  : clerkMiddleware(async (auth, req) => {
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

import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// Minimal root layout — the ONLY <html>/<body> in the app, shared by every
// route. It intentionally carries no providers, analytics, or web fonts so the
// embedded Shopify app (/shopify-admin), which sits directly under this root,
// stays as light as possible (its App Store LCP gate is < 2.5s). Everything that
// needs Clerk, PostHog, or the brand fonts lives under the (app) route group,
// which adds them in its own nested layout (see src/app/(app)/layout.tsx).
// Fonts are declared there, so next/font only preloads them for (app) routes —
// never for the embed.

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Asmos | AI Conversion Optimization for Ecommerce",
    template: "%s | Asmos",
  },
  description:
    "Asmos analyzes your store, generates conversion experiments, tests variants, learns from visitor behavior, and continuously improves performance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

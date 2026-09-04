import { Geist } from "next/font/google";
import { Barlow_Condensed } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Suspense } from "react";
import { PostHogProvider } from "@/lib/posthog";
import { PostHogPageView } from "@/components/PostHogPageView";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationJsonLd } from "@/lib/seo";

// The app/marketing group layout. Everything that needs Clerk auth, PostHog
// analytics, and the brand web fonts lives under here. Deliberately NOT in the
// shared root layout: the embedded Shopify app (/shopify-admin) sits directly
// under the minimal root instead, so it loads none of this — no Clerk SDK, no
// cross-origin Clerk handshake, no PostHog, and (crucially for its LCP) no
// web-font preloads. See src/app/layout.tsx for the reasoning.

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      {/* display:contents so this wrapper doesn't become the sole flex child of
          <body> (which would break pages that rely on being direct flex
          children). The font CSS variables + resolved font-family are declared
          here rather than on <body>, so only routes under this group instantiate
          and preload the fonts — the embed under the root layout never does.
          globals.css resolves var(--font-sans)/(--font-geist) here where they're
          defined; the embed falls back to the system stack. */}
      <div
        className={`${geist.variable} ${barlowCondensed.variable}`}
        style={{ display: "contents", fontFamily: "var(--font-sans), system-ui, sans-serif" }}
      >
        <JsonLd data={organizationJsonLd()} />
        <PostHogProvider>
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          {children}
        </PostHogProvider>
      </div>
    </ClerkProvider>
  );
}

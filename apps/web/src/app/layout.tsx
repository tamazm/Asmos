import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Barlow_Condensed } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Suspense } from "react";
import { PostHogProvider } from "@/lib/posthog";
import { PostHogPageView } from "@/components/PostHogPageView";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationJsonLd } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Asmos — AI Conversion Optimization for Ecommerce",
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
    <ClerkProvider>
      <html lang="en" className={`${geist.variable} ${barlowCondensed.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col">
          <JsonLd data={organizationJsonLd()} />
          <PostHogProvider>
            <Suspense fallback={null}>
              <PostHogPageView />
            </Suspense>
            {children}
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

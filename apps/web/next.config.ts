import type { NextConfig } from "next";

// Shopify embeds the app in an iframe inside the Shopify admin (and, for the
// theme editor, the merchant's own *.myshopify.com store). frame-ancestors is
// how an embedded app opts into being framed — without it the admin renders a
// blank iframe and App Store review fails. Scoped to the Shopify surfaces only
// (see headers() below) so the rest of Asmos stays unframeable/clickjack-safe.
// Only frame-ancestors is set here on purpose: a script-src/default-src CSP
// would also have to allow Shopify's CDN (App Bridge + Polaris load from there)
// and is easy to get wrong, so it's deferred to App Store hardening.
const SHOPIFY_FRAME_ANCESTORS =
  "frame-ancestors https://admin.shopify.com https://*.myshopify.com;";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', 'prisma', '@prisma/adapter-pg', 'pg'],
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    const csp = [{ key: "Content-Security-Policy", value: SHOPIFY_FRAME_ANCESTORS }];
    return [
      { source: "/shopify-admin", headers: csp },
      { source: "/shopify-admin/:path*", headers: csp },
      { source: "/api/shopify/:path*", headers: csp },
    ];
  },
};

export default nextConfig;

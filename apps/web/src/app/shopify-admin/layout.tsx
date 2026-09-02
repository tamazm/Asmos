// Embedded admin shell - everything under /shopify-admin renders inside the
// Shopify Admin iframe. Deliberately outside the (dashboard) route group:
// no Clerk auth here at all, matching "well integrated app" (session-token
// auth only, see src/lib/shopify/withShopifySession.ts).
//
// The two <script> tags below are plain native elements, not next/script:
// Shopify requires App Bridge to be the first script in <head>, loaded
// synchronously (no bundler, no defer/async) - a plain native script tag
// is parser-blocking and loads in document order by default, which matches
// that requirement more literally than next/script's client-injected
// strategies. React 19 hoists <script>/<link>/<meta> rendered anywhere in
// the tree into the real document <head> (this file is a nested layout, so
// it can't render its own <html>/<head> directly - see Next's "multiple
// root layouts" docs if stricter first-script-in-head ordering is ever
// needed; that requires restructuring into a route group with its own root
// layout, which single-root-layout Asmos doesn't use today).
//
// Verifying this hoisted ordering actually satisfies Shopify's admin
// performance check is Milestone B4's job, not this shell's.
export default function ShopifyAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Warm the TLS/handshake to Shopify's CDN before the parser reaches the
          scripts below — shaves handshake latency off App Bridge/Polaris and,
          with it, LCP (App Store perf gate: LCP < 2.5s). */}
      <link rel="preconnect" href="https://cdn.shopify.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://cdn.shopify.com" />
      <meta name="shopify-api-key" content={process.env.NEXT_PUBLIC_SHOPIFY_API_KEY} />
      {/* App Bridge MUST stay the first script and load synchronously (Shopify's
          "latest App Bridge / admin performance" requirement) — do not defer it.
          eslint-disable-next-line: intentional unbundled parser-blocking script. */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script
        src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
        data-api-key={process.env.NEXT_PUBLIC_SHOPIFY_API_KEY}
      />
      {/* Polaris, by contrast, has no first-script requirement. Loading it
          `defer` unblocks the body paint (it no longer stalls the parser), which
          is the single biggest LCP win here: the plain-HTML first screen in
          page.tsx can paint right after App Bridge instead of waiting on Polaris.
          `defer` still executes before DOMContentLoaded — long before the async
          session round-trip completes — so s-* components are always upgraded by
          the time the app flips from skeleton to the Polaris UI. */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="https://cdn.shopify.com/shopifycloud/polaris.js" defer />
      {children}
    </>
  );
}

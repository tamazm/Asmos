// Embedded admin shell — everything under /shopify-admin renders inside the
// Shopify Admin iframe. Deliberately outside the (dashboard) route group:
// no Clerk auth here at all, matching "well integrated app" (session-token
// auth only, see src/lib/shopify/withShopifySession.ts).
//
// The two <script> tags below are plain native elements, not next/script:
// Shopify requires App Bridge to be the first script in <head>, loaded
// synchronously (no bundler, no defer/async) — a plain native script tag
// is parser-blocking and loads in document order by default, which matches
// that requirement more literally than next/script's client-injected
// strategies. React 19 hoists <script>/<link>/<meta> rendered anywhere in
// the tree into the real document <head> (this file is a nested layout, so
// it can't render its own <html>/<head> directly — see Next's "multiple
// root layouts" docs if stricter first-script-in-head ordering is ever
// needed; that requires restructuring into a route group with its own root
// layout, which single-root-layout Asmos doesn't use today).
//
// Verifying this hoisted ordering actually satisfies Shopify's admin
// performance check is Milestone B4's job, not this shell's.
export default function ShopifyAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <meta name="shopify-api-key" content={process.env.NEXT_PUBLIC_SHOPIFY_API_KEY} />
      <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
      <script src="https://cdn.shopify.com/shopifycloud/polaris.js" />
      {children}
    </>
  );
}

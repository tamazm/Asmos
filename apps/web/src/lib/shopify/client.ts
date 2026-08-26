import "@shopify/shopify-api/adapters/web-api";
import { shopifyApi, ApiVersion, LogSeverity, type Shopify } from "@shopify/shopify-api";

// Framework-agnostic Shopify API client (OAuth, token exchange, webhook
// verification, Admin GraphQL). The web-api adapter registers Web-standard
// Request/Response handling globally, which is what Next.js Route Handlers
// use - do not also import the node adapter, the two conflict.
//
// SHOPIFY_APP_URL is the app's public origin (e.g. "https://app.asmos.io",
// or an ngrok/tunnel URL for local dev) - hostName below is that origin
// with the protocol stripped, per @shopify/shopify-api's expected format.
//
// Instantiation is deferred behind a Proxy rather than done at module scope:
// Next.js's build-time "Collecting page data" step imports and evaluates
// every route module (not just at request time), so an eager shopifyApi()
// call here would throw during `next build` in any environment without
// these env vars set (e.g. CI without secrets). The Proxy only touches env
// vars the first time a route handler actually accesses shopify.<anything>.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function hostNameFromAppUrl(appUrl: string): string {
  return appUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

let instance: Shopify | undefined;

function getShopify(): Shopify {
  if (!instance) {
    instance = shopifyApi({
      apiKey: requireEnv("SHOPIFY_API_KEY"),
      apiSecretKey: requireEnv("SHOPIFY_API_SECRET"),
      scopes: requireEnv("SHOPIFY_SCOPES").split(",").map((s) => s.trim()).filter(Boolean),
      hostName: hostNameFromAppUrl(requireEnv("SHOPIFY_APP_URL")),
      hostScheme: "https",
      apiVersion: ApiVersion.July26,
      isEmbeddedApp: true,
      logger: { level: LogSeverity.Warning },
    });
  }
  return instance;
}

export const shopify: Shopify = new Proxy({} as Shopify, {
  get(_target, prop, receiver) {
    return Reflect.get(getShopify(), prop, receiver);
  },
});

// Minimal JSX typings for the Polaris web components (`s-*` custom elements,
// loaded via CDN script in shopify-admin/layout.tsx — no npm component
// package). Extend this file as more elements are used; see
// https://shopify.dev/docs/api/app-home/polaris-web-components for the
// full catalog, or install @shopify/polaris-types for generated types.
// Also declares the App Bridge `window.shopify` global (also CDN-loaded).

type PolarisElementProps = React.HTMLAttributes<HTMLElement> & {
  [attr: string]: unknown;
};

// React 19 resolves JSX intrinsics via React's own namespace (not the bare
// global `JSX` namespace) — augment that, per @types/react ^19.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "s-page": PolarisElementProps & { heading?: string };
      "s-section": PolarisElementProps & { heading?: string };
      "s-box": PolarisElementProps;
      "s-banner": PolarisElementProps & { tone?: "info" | "success" | "warning" | "critical"; heading?: string };
      "s-button": PolarisElementProps & {
        onClick?: () => void;
        variant?: string;
        tone?: string;
        disabled?: boolean;
        loading?: boolean;
      };
      "s-stack": PolarisElementProps & { direction?: "inline" | "block"; gap?: string; alignItems?: string; justifyContent?: string };
      "s-text": PolarisElementProps & { type?: string; tone?: string };
      "s-paragraph": PolarisElementProps;
      "s-heading": PolarisElementProps;
      "s-link": PolarisElementProps & { href?: string; target?: string };
      "s-badge": PolarisElementProps & { tone?: "info" | "success" | "warning" | "critical" | "neutral" };
      "s-divider": PolarisElementProps;
      "s-spinner": PolarisElementProps & { accessibilityLabel?: string };
    }
  }
}

// App Bridge Scopes API — https://shopify.dev/docs/api/app-home/apis/authentication-and-data/scopes-api
type ShopifyScopesState = {
  granted: string[];
  required: string[];
  optional: string[];
};

declare global {
  interface Window {
    shopify?: {
      idToken: () => Promise<string>;
      config?: { shop?: string; host?: string; apiKey?: string };
      environment?: { embedded?: boolean; mobile?: boolean };
      scopes: {
        query: () => Promise<ShopifyScopesState>;
        request: (scopes: string[]) => Promise<ShopifyScopesState>;
        revoke: (scopes: string[]) => Promise<ShopifyScopesState>;
      };
      toast?: { show: (message: string, options?: { isError?: boolean; duration?: number }) => void };
    };
  }
}

export {};

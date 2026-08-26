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
      "s-page": PolarisElementProps;
      "s-banner": PolarisElementProps & { tone?: "info" | "success" | "warning" | "critical" };
      "s-button": PolarisElementProps & {
        onClick?: () => void;
        variant?: string;
        disabled?: boolean;
      };
      "s-stack": PolarisElementProps & { direction?: "inline" | "block"; gap?: string };
      "s-text": PolarisElementProps & { type?: string };
      "s-heading": PolarisElementProps;
      "s-spinner": PolarisElementProps;
    }
  }
}

declare global {
  interface Window {
    shopify?: {
      idToken: () => Promise<string>;
    };
  }
}

export {};

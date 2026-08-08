// Central site constants — nav, footer, contact info, external links.

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://asmos.io";
export const SITE_NAME = "Asmos";
export const SITE_TAGLINE = "AI conversion optimization for ecommerce";

export const FOUNDER_EMAIL = "saba@asmos.io";

export const MAIN_NAV = [
  { label: "Home", href: "/" },
  { label: "Why Asmos", href: "/why-asmos" },
  { label: "Pricing", href: "/pricing" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
] as const;

export const FOOTER_LINKS = {
  Product: [
    { label: "Free Trial", href: "/sign-up" },
    { label: "Pricing", href: "/pricing" },
    { label: "Integrations", href: "/why-asmos#integrations" },
    { label: "Managed Success", href: "/why-asmos#managed-success" },
  ],
  "Free Tools": [
    { label: "Free Optimization Analysis", href: "/analyze" },
    { label: "Email Capture Revenue Calculator", href: "/tools/email-capture-calculator" },
    { label: "Traffic Calculator", href: "/tools/traffic-calculator" },
  ],
  Resources: [{ label: "Blog", href: "/blog" }],
  Company: [
    { label: "Why Asmos", href: "/why-asmos" },
    { label: "Contact", href: "/contact" },
  ],
} as const;

// CTA hierarchy used consistently across every marketing page.
export const CTA = {
  primary: { label: "Start Free Trial", href: "/sign-up" },
  secondary: { label: "Book a Demo", href: "/contact#book-a-demo" },
  tertiary: { label: "Try the Free Optimization Analysis", href: "/analyze" },
} as const;

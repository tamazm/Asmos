// Shared prop shape for every popup template (AI popup variation roadmap,
// Phase 3). Each template in this directory implements a `render*Template`
// function with this signature — see lib/templates/index.ts for the
// template_id -> render function dispatch.
export interface PopupTemplateProps {
  headline: string;
  subhead: string;
  cta: string;
  primaryColor: string;
  couponCode?: string | null;
  imageUrl?: string | null;
  goal?: "EMAIL" | "DISCOUNT" | "BOTH";
  layoutStyle?: "split-left" | "split-right" | "centered" | "minimal";
}

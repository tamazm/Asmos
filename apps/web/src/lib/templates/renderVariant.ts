import { renderPopupTemplate } from ".";
import { sanitizeRedirectUrl, sanitizeCaptureFields } from "./runtime";

type VariantDesign = {
  headline?: string;
  body?: string;
  ctaText?: string;
  primaryColor?: string;
  imageUrl?: string | null;
  redirectUrl?: string | null;
};

type VariantSpec = {
  template_id?: string;
  layout_style?: string;
  dna?: unknown;
  design_tokens?: { type_display?: string | null; type_body?: string | null; palette?: string[] | null } | null;
  discount_percent?: number | null;
};

/**
 * Re-render a variant's stored HTML (`generatedCode`) from its persisted
 * `design` + `popupSpec`, for a given set of capture fields.
 *
 * Live popups render from `generatedCode` (a baked HTML blob), not from
 * `formFields`, so changing which fields a popup collects must regenerate this.
 * Centralizes the spec→HTML mapping shared by the campaign-page phone toggle and
 * the Twilio "add phone to my live popups" action. `captureFields` is sanitized
 * to the optional-field set (name/phone); email is always rendered.
 */
export function renderVariantGeneratedCode(
  variant: { design: unknown; popupSpec: unknown },
  opts: { captureFields: unknown; goal?: "EMAIL" | "DISCOUNT" | "BOTH"; couponCode?: string | null },
): string {
  const design = (variant.design ?? {}) as VariantDesign;
  const spec = (variant.popupSpec ?? {}) as VariantSpec;

  return renderPopupTemplate(spec.template_id, {
    headline: design.headline ?? "",
    subhead: design.body ?? "",
    cta: design.ctaText ?? "",
    primaryColor: design.primaryColor ?? "#111827",
    imageUrl: design.imageUrl ?? null,
    couponCode: opts.couponCode ?? null,
    goal: opts.goal ?? "BOTH",
    layoutStyle: spec.layout_style as "split-left" | "split-right" | "centered" | "minimal" | undefined,
    dna: spec.dna as Parameters<typeof renderPopupTemplate>[1]["dna"],
    brandFonts: spec.design_tokens ?? null,
    palette: spec.design_tokens?.palette ?? null,
    discountPercent: spec.discount_percent ?? null,
    redirectUrl: sanitizeRedirectUrl(design.redirectUrl ?? undefined),
    captureFields: sanitizeCaptureFields(opts.captureFields),
  });
}

/** Ensure "phone" is in a capture-field list iff includePhone; strips it otherwise. */
export function withPhoneField(fields: unknown, includePhone: boolean): string[] {
  const base = Array.isArray(fields) ? fields.filter((f): f is string => typeof f === "string") : [];
  const withoutPhone = base.filter((f) => f !== "phone");
  return includePhone ? [...withoutPhone, "phone"] : withoutPhone;
}

/** True when a capture-field list collects a phone number. */
export function fieldsCollectPhone(fields: unknown): boolean {
  return Array.isArray(fields) && fields.includes("phone");
}

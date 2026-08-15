"use client";

import { useState } from "react";
import { updateVariantDesign } from "./actions";
import { allImageUrls } from "@/lib/imageLibrary";

// Shared with the AI generation prompt (see lib/imageLibrary.ts) so the
// manual picker offers the same curated, category-organized set instead of
// its own separate 3-image list.
const PRESET_IMAGES = allImageUrls(800);

export function VisualEditor({
  campaignId,
  variantId,
  defaultColor,
  initialDesign,
  initialRewards,
}: {
  campaignId: string;
  variantId: string;
  // Only used as the colour picker's starting point on the rare variant that
  // somehow has no primaryColor of its own yet — not "the brand colour" as a
  // product concept (see popupGeneration.ts's brandTokensFromAnalyzeResult).
  defaultColor: string;
  initialDesign: {
    headline?: string;
    body?: string;
    ctaText?: string;
    primaryColor?: string;
    imageUrl?: string;
  };
  initialRewards?: { id: string; label: string; couponCode: string | null }[];
}) {
  const [headline, setHeadline] = useState(initialDesign.headline || "");
  const [body, setBody] = useState(initialDesign.body || "");
  const [ctaText, setCtaText] = useState(initialDesign.ctaText || "");
  const [primaryColor, setPrimaryColor] = useState(initialDesign.primaryColor || defaultColor);
  const [imageUrl, setImageUrl] = useState(initialDesign.imageUrl || "");
  const [rewards, setRewards] = useState(initialRewards || []);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateVariantDesign(campaignId, variantId, {
        headline,
        body,
        ctaText,
        primaryColor,
        imageUrl,
      });
      alert("Design updated successfully! The preview will reflect your changes.");
    } catch (err) {
      alert("Failed to update design.");
    }
    setIsSaving(false);
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setImageUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  return (
    <form onSubmit={handleSave} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[color:var(--color-text-primary)]">
          Visual Editor
        </h2>
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">
            Headline
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-black"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">
            Body (Subhead)
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-black"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">
            CTA Text
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-black"
            value={ctaText}
            onChange={(e) => setCtaText(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">
            Image
          </label>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {PRESET_IMAGES.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setImageUrl(preset)}
                className={`relative aspect-square overflow-hidden rounded-md border-2 transition-all ${imageUrl === preset ? "border-[color:var(--color-primary)] ring-2 ring-[color:var(--color-primary)]/20" : "border-transparent hover:border-gray-300"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preset} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-black"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Custom Image URL..."
            />
            <div className="relative w-full">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <button
                type="button"
                className="w-full text-center rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 font-medium"
              >
                Upload from device
              </button>
            </div>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">
            Primary Color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="h-8 w-8 rounded-md border-0 p-0"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
            />
            <input
              type="text"
              className="w-32 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-mono text-black"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
            />
          </div>
        </div>
      </div>

      {rewards.length > 0 && (
        <div className="mt-6 pt-6 border-t border-[color:var(--color-border)]">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--color-text-primary)]">
            Coupon Codes
          </h3>
          <div className="flex flex-col gap-3">
            {rewards.map((reward, idx) => (
              <div key={reward.id} className="grid grid-cols-2 gap-4 items-center">
                <label className="text-sm font-medium text-[color:var(--color-text-secondary)]">
                  {reward.label}
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-black"
                  value={reward.couponCode || ""}
                  onChange={(e) => {
                    const newRewards = [...rewards];
                    newRewards[idx].couponCode = e.target.value;
                    setRewards(newRewards);
                  }}
                  placeholder="e.g. SUMMER20"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}

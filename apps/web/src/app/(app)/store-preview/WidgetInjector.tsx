"use client";

import { useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface WidgetInjectorProps {
  site: string;
  defaultVariantId?: string;
}

function WidgetInjectorInner({ site, defaultVariantId }: WidgetInjectorProps) {
  const searchParams = useSearchParams();
  const variantId = searchParams.get("variantId") || defaultVariantId;
  const prevVariantIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (prevVariantIdRef.current === variantId) return;
    prevVariantIdRef.current = variantId;

    // 1. Tear down any existing popup containers
    document.querySelectorAll("#asmosPopupOverlay").forEach((el) => el.remove());
    document.querySelectorAll("[data-asmos-popup]").forEach((el) => el.remove());

    // Remove previously injected widget script
    document.querySelectorAll("script[data-asmos-widget]").forEach((s) => s.remove());

    // 2. Inject a completely fresh <script> tag so it re-executes from scratch
    const script = document.createElement("script");
    script.src = `/widget.js?bust=${Date.now()}`;
    script.setAttribute("data-asmos-widget", "true");
    script.setAttribute("data-site", site);
    script.setAttribute("data-preview", "true");
    if (variantId) {
      script.setAttribute("data-preview-variant-id", variantId);
    }

    document.body.appendChild(script);

    return () => {
      script.remove();
      document.querySelectorAll("#asmosPopupOverlay").forEach((el) => el.remove());
      document.querySelectorAll("[data-asmos-popup]").forEach((el) => el.remove());
    };
  }, [site, variantId]);

  return null;
}

export function WidgetInjector({ site, defaultVariantId }: WidgetInjectorProps) {
  return (
    <Suspense fallback={null}>
      <WidgetInjectorInner site={site} defaultVariantId={defaultVariantId} />
    </Suspense>
  );
}

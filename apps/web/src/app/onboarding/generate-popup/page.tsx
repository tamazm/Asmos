"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface AnalyzeResult {
  storeName?: string;
  industry?: string;
  brandColor?: string;
  storeUrl?: string;
}

type Phase = "loading" | "error";

export default function GeneratePopupPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [storeName, setStoreName] = useState<string>("your store");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    async function run() {
      let analyzeData: AnalyzeResult = {};
      try {
        const raw = sessionStorage.getItem("asmos_analyze_result");
        if (raw) analyzeData = JSON.parse(raw) as AnalyzeResult;
      } catch {
        // ignore
      }

      if (analyzeData.storeName) setStoreName(analyzeData.storeName);

      try {
        // 1. Get websiteId from /api/account
        const accountRes = await fetch("/api/account");
        if (!accountRes.ok) throw new Error("Could not load account");
        const accountData = await accountRes.json();
        const websiteId = accountData?.websites?.[0]?.id;
        if (!websiteId) throw new Error("No website found — connect your store first.");

        const brandColor = analyzeData.brandColor ?? "#165DFF";
        const industry = analyzeData.industry ?? "Ecommerce / Retail";
        const name = analyzeData.storeName ?? "My Store";

        // 2. Create campaign
        const campaignPayload = {
          name: `${name} Welcome Popup`,
          type: "FORM",
          design: {
            headline: `Get 10% off your first order`,
            body: `Join thousands of happy ${name} customers. Subscribe for exclusive deals.`,
            primaryColor: brandColor,
            ctaText: "Claim my discount",
          },
          formFields: ["email"],
          targeting: {
            trigger: "time_delay",
            delaySeconds: 3,
          },
          rewards: [
            {
              label: "10% off your first order",
              type: "DISCOUNT_PERCENT",
              couponCode: "WELCOME10",
              weight: 100,
            },
          ],
          // These top-level fields are needed by the campaigns POST route
          websiteId,
          goal: "email_capture",
          offer: "discount",
          audienceTrigger: "new_visitors",
          triggerDelay: 3,
        };

        const campaignRes = await fetch("/api/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(campaignPayload),
        });

        if (!campaignRes.ok) {
          const body = await campaignRes.json().catch(() => ({}));
          throw new Error(body.error ?? "Could not create campaign");
        }

        const { campaign } = await campaignRes.json();
        const campaignId: string = campaign.id;

        // 3. Add a variant with brand-specific design
        await fetch(`/api/campaigns/${campaignId}/variants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${industry} Variant`,
            design: {
              headline: `Exclusive offer for you`,
              body: `${name} — limited time deal for new subscribers.`,
              primaryColor: brandColor,
              ctaText: "Get the deal",
            },
            formFields: ["email"],
            targeting: {
              trigger: "exit_intent",
              delaySeconds: null,
            },
            rewards: [
              {
                label: "10% off your first order",
                type: "DISCOUNT_PERCENT",
                couponCode: "WELCOME10",
                weight: 100,
              },
            ],
          }),
        }).catch(() => {
          // Non-fatal — campaign was created; variant failure is ok
        });

        // 4. Redirect to campaign
        router.push(`/campaigns/${campaignId}`);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Something went wrong");
        setPhase("error");
      }
    }

    run();
  }, [router]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[color:var(--color-surface-sunken)] px-6 py-12">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {phase === "loading" && (
        <div className="flex flex-col items-center gap-5 text-center max-w-xs animate-page-enter">
          {/* Spinner */}
          <div
            className="h-11 w-11 rounded-full border-4 border-[color:var(--color-primary-light)] border-t-[color:var(--color-primary)]"
            style={{ animation: "spin 0.8s linear infinite" }}
          />
          <div>
            <h1 className="text-lg font-bold text-[color:var(--color-text-primary)]">
              Building your popup for {storeName}…
            </h1>
            <p className="mt-1.5 text-sm text-[color:var(--color-text-secondary)] leading-relaxed">
              Using your brand color and industry to generate a high-converting first popup.
            </p>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="flex flex-col items-center gap-5 text-center max-w-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-[color:var(--color-text-primary)]">
              Something went wrong
            </h1>
            {errorMsg && (
              <p className="mt-1.5 text-sm text-red-600 leading-relaxed">{errorMsg}</p>
            )}
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)] transition-colors"
          >
            Go to dashboard
          </button>
        </div>
      )}
    </div>
  );
}

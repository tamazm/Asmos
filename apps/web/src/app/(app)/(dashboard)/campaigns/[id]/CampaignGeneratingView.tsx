"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";

export function CampaignGeneratingView({ campaignName }: { campaignName: string }) {
  const router = useRouter();

  useEffect(() => {
    // Poll every 3 seconds to see if generation is complete
    const interval = setInterval(() => {
      router.refresh();
    }, 3000);

    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-10 max-w-[1400px] mx-auto w-full">
      <PageHeader title={campaignName} />
      <p className="text-sm text-[color:var(--color-text-secondary)] mt-[-1rem]">Campaign generation in progress</p>
      <div className="flex flex-col items-center justify-center gap-6 py-20">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span className="absolute inline-block h-24 w-24 rounded-full border border-[color:var(--color-primary)] opacity-20 animate-ping" />
          <span className="absolute inline-block h-16 w-16 rounded-full border border-[color:var(--color-primary)]/40" />
          <span className="inline-block h-6 w-6 rounded-full border-2 border-[color:var(--color-primary)] border-t-transparent animate-spin" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-[color:var(--color-text-primary)]">Asmos AI is designing your variants</h3>
          <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
            This usually takes about 30 seconds. Feel free to wait or check back later, your campaign is safely saved!
          </p>
        </div>
      </div>
    </div>
  );
}

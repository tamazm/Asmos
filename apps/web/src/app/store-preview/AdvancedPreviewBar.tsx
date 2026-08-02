"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { useState, useEffect, Suspense } from "react";

export type PreviewVariant = {
  id: string;
  name: string;
  isControl: boolean;
  isWinner: boolean;
  status: string;
};

export type PreviewCampaign = {
  id: string;
  name: string;
  status: string;
  variants: PreviewVariant[];
};

function AdvancedPreviewBarInner({ campaigns }: { campaigns: PreviewCampaign[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const initialVariantId = searchParams.get("variantId");
  let initialCampaignId = campaigns.length > 0 ? campaigns[0].id : "";
  
  if (initialVariantId) {
    const c = campaigns.find(c => c.variants.some(v => v.id === initialVariantId));
    if (c) initialCampaignId = c.id;
  }

  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(initialCampaignId);
  
  // If variantId param is not in URL, but we have campaigns, set the first variant
  useEffect(() => {
    if (!initialVariantId && campaigns.length > 0 && campaigns[0].variants.length > 0) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("variantId", campaigns[0].variants[0].id);
      router.replace(newUrl.pathname + newUrl.search);
    }
  }, [initialVariantId, campaigns, router]);

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);
  const variants = selectedCampaign?.variants ?? [];

  function handleCampaignSelect(campaignId: string) {
    setSelectedCampaignId(campaignId);
    const c = campaigns.find((camp) => camp.id === campaignId);
    if (c && c.variants.length > 0) {
      updateUrlVariant(c.variants[0].id);
    } else {
      updateUrlVariant("");
    }
  }
  
  function updateUrlVariant(variantId: string) {
    const newUrl = new URL(window.location.href);
    if (variantId) {
      newUrl.searchParams.set("variantId", variantId);
    } else {
      newUrl.searchParams.delete("variantId");
    }
    router.replace(newUrl.pathname + newUrl.search);
  }

  return (
    <div className="bg-[#1a1a1a] border-b border-gray-800 text-white p-4 shadow-xl z-[2147483647] relative flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Campaign Selection */}
        <div className="flex flex-col gap-2">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Campaign</span>
          <select 
            className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
            value={selectedCampaignId}
            onChange={(e) => handleCampaignSelect(e.target.value)}
          >
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name} {c.status === 'PAUSED' ? '(Paused)' : ''}</option>
            ))}
          </select>
        </div>

        {/* Variant Selection */}
        <div className="flex flex-col gap-2">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Variant Preview</span>
          <div className="flex gap-2 flex-wrap">
            {variants.map(v => (
              <button
                key={v.id}
                onClick={() => updateUrlVariant(v.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors flex items-center gap-2 ${
                  initialVariantId === v.id 
                    ? "bg-indigo-600 border-indigo-500 text-white" 
                    : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
              >
                {v.name}
                {v.isControl && <span className="bg-gray-600 text-white px-1.5 rounded-sm text-[10px]">Control</span>}
              </button>
            ))}
            {variants.length === 0 && <span className="text-sm text-gray-500 py-1.5">No variants</span>}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <a href="/campaigns" className="text-sm text-gray-400 hover:text-white underline underline-offset-4">Back to Dashboard</a>
      </div>
    </div>
  );
}

export function AdvancedPreviewBar({ campaigns }: { campaigns: PreviewCampaign[] }) {
  return (
    <Suspense fallback={<div className="bg-[#1a1a1a] h-20 w-full" />}>
      <AdvancedPreviewBarInner campaigns={campaigns} />
    </Suspense>
  );
}

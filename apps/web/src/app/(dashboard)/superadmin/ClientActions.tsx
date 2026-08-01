"use client";

import { deleteCampaign, retryCampaign, triggerCronNow } from "./actions";
import { useState } from "react";

export function SuperadminActions({ campaignId }: { campaignId: string }) {
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex gap-2">
      <button
        disabled={loading}
        onClick={async () => {
          if (!confirm("Delete campaign?")) return;
          setLoading(true);
          await deleteCampaign(campaignId);
          setLoading(false);
        }}
        className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
      >
        Delete
      </button>
      <button
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          await retryCampaign(campaignId);
          setLoading(false);
        }}
        className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
      >
        Retry
      </button>
    </div>
  );
}

export function TriggerCronButton() {
  const [loading, setLoading] = useState(false);

  return (
    <button
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await triggerCronNow();
        setLoading(false);
      }}
      className="px-4 py-2 bg-[color:var(--color-primary)] text-white font-semibold rounded-lg text-sm disabled:opacity-50"
    >
      {loading ? "Triggering..." : "Trigger Generate Cron Now"}
    </button>
  );
}

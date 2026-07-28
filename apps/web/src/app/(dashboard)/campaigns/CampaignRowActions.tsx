"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CampaignRowActions({
  campaignId,
  status,
}: {
  campaignId: string;
  status: string;
}) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  async function setStatus(next: "ACTIVE" | "PAUSED") {
    setUpdating(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) router.refresh();
    } finally {
      setUpdating(false);
    }
  }

  if (status !== "ACTIVE" && status !== "PAUSED") return null;

  return (
    <button
      type="button"
      disabled={updating}
      onClick={() => setStatus(status === "ACTIVE" ? "PAUSED" : "ACTIVE")}
      className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)] disabled:opacity-60"
    >
      {updating ? "…" : status === "ACTIVE" ? "Pause" : "Activate"}
    </button>
  );
}

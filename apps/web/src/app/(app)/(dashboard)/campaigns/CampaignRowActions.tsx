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
  const [deleting, setDeleting] = useState(false);

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

  async function handleDelete() {
    if (
      !window.confirm(
        "Delete this popup? If it has 50 or more impressions, it'll be archived (hidden, stops running) so that meaningful data isn't lost. Otherwise it's removed entirely. This can't be undone.",
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/campaigns");
        router.refresh();
      } else {
        setDeleting(false);
      }
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {(status === "ACTIVE" || status === "PAUSED") && (
        <button
          type="button"
          disabled={updating}
          onClick={() => setStatus(status === "ACTIVE" ? "PAUSED" : "ACTIVE")}
          className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)] disabled:opacity-60"
        >
          {updating ? "…" : status === "ACTIVE" ? "Pause" : "Activate"}
        </button>
      )}
      {status !== "ARCHIVED" && (
        <button
          type="button"
          disabled={deleting}
          onClick={handleDelete}
          className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          {deleting ? "…" : "Delete"}
        </button>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { KnockoutBracket } from "./KnockoutBracket";
import { AddVariantPanel } from "./AddVariantPanel";
import { ScheduledVariants } from "./ScheduledVariants";
import { type VariantStat } from "./VariantManager";

export function KnockoutBracketWithVariants({
  campaignId,
  initialVariants,
}: {
  campaignId: string;
  initialVariants: VariantStat[];
}) {
  const [variants, setVariants] = useState<VariantStat[]>(initialVariants);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);

  function handleVariantAdded(newVariant: VariantStat) {
    setVariants((prev) => [...prev, newVariant]);
    setNewlyAddedId(newVariant.id);
    // Clear the "newly added" marker after the scheduled variants animation completes
    setTimeout(() => setNewlyAddedId(null), 4000);
  }

  const nonControlVariants = variants.filter((v) => !v.isControl);
  const canAddMore = variants.length < 5;

  return (
    <div className="flex flex-col gap-6">
      {/* Add variant panel */}
      {canAddMore && (
        <AddVariantPanel
          campaignId={campaignId}
          existingCount={variants.length}
          onVariantAdded={handleVariantAdded}
        />
      )}

      {/* Knockout bracket */}
      <KnockoutBracket variants={variants} />

      {/* Scheduled variants - only when there are non-control variants */}
      {nonControlVariants.length > 0 && (
        <ScheduledVariants
          variants={variants}
          newlyAddedVariantId={newlyAddedId}
        />
      )}
    </div>
  );
}

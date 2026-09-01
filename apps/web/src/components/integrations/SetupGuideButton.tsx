"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export function SetupGuideButton({
  providerName,
  docsUrl,
  setupSteps,
}: {
  providerName: string;
  docsUrl?: string;
  setupSteps?: string[];
}) {
  const [open, setOpen] = useState(false);

  if (!setupSteps || setupSteps.length === 0) {
    if (!docsUrl) return null;
    return (
      <a href={docsUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-sm text-[color:var(--color-primary)] hover:underline">
        Docs
      </a>
    );
  }

  return (
    <>
      <button 
        type="button"
        onClick={(e) => { e.preventDefault(); setOpen(true); }} 
        className="ml-2 text-sm text-[color:var(--color-primary)] hover:underline"
      >
        How to connect
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`How to connect ${providerName}`} size="md">
        <div className="p-5 space-y-4">
          <ol className="list-decimal pl-5 space-y-2 text-sm text-[color:var(--color-text-secondary)]">
            {setupSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          {docsUrl && (
            <div className="pt-4 mt-4 border-t border-[color:var(--color-border)]">
              <a href={docsUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[color:var(--color-primary)] hover:underline flex items-center gap-1">
                Open {providerName} Documentation
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              </a>
            </div>
          )}
          <div className="pt-2 text-right">
            <Button onClick={() => setOpen(false)}>Got it</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

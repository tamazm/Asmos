"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type CheckState = "idle" | "checking" | "verified" | "not_detected";

export default function InstallVerificationPage() {
  const [state, setState] = useState<CheckState>("idle");

  async function runCheck() {
    setState("checking");
    try {
      const res = await fetch("/api/onboarding/verify", { method: "POST" });
      const data = await res.json();
      setState(data.verified ? "verified" : "not_detected");
    } catch {
      setState("not_detected");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-[color:var(--color-text-primary)]">
          Verify installation
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
          We&apos;ll check that the snippet is live on your site.
        </p>
      </div>

      <div className="rounded-lg border border-[color:var(--color-border)] p-4">
        {state === "idle" && (
          <Button variant="secondary" onClick={runCheck}>
            Check Installation
          </Button>
        )}
        {state === "checking" && (
          <p className="text-sm text-[color:var(--color-text-secondary)]">
            Checking your site...
          </p>
        )}
        {state === "verified" && (
          <div className="flex flex-col gap-2">
            <Badge variant="success">Installed</Badge>
            <p className="text-sm text-[color:var(--color-text-secondary)]">
              We found the widget snippet live on your site.
            </p>
          </div>
        )}
        {state === "not_detected" && (
          <div className="flex flex-col gap-2">
            <Badge variant="neutral">Not detected yet</Badge>
            <p className="text-sm text-[color:var(--color-text-secondary)]">
              We couldn&apos;t find the snippet on your site yet. Make sure it&apos;s
              added to your site&apos;s HTML, then check again.
            </p>
            <Button variant="secondary" onClick={runCheck} className="w-fit">
              Check Again
            </Button>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button href="/onboarding/connect-website" variant="secondary">
          Back
        </Button>
        <Button href="/onboarding/business-profile">Continue</Button>
      </div>
    </div>
  );
}

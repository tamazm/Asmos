"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { onboardingStepCompleted } from "@/lib/analytics";

const SHOPIFY_INSTRUCTIONS = `1. In your Shopify admin, go to Online Store > Themes
2. Click "Edit code" on your active theme
3. Open layout/theme.liquid
4. Paste the snippet just before the closing </head> tag
5. Save the file`;

const WORDPRESS_INSTRUCTIONS = `1. In your WordPress dashboard, go to Appearance > Theme Editor
2. Open the header.php file
3. Paste the snippet just before the closing </head> tag
4. Update the file`;

const CUSTOM_INSTRUCTIONS = `Paste the snippet into your HTML, just before the closing </head> tag.
If you're using a tag manager (Google Tag Manager, Segment, etc.) you can also add it as a Custom HTML tag that fires on all pages.`;

const TABS = [
  { id: "shopify", label: "Shopify", instructions: SHOPIFY_INSTRUCTIONS },
  { id: "wordpress", label: "WordPress", instructions: WORDPRESS_INSTRUCTIONS },
  { id: "custom", label: "Custom HTML", instructions: CUSTOM_INSTRUCTIONS },
] as const;

type TabId = (typeof TABS)[number]["id"];

const WIDGET_HOST =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://app.asmos.io";

function buildSnippet(siteKey: string) {
  return `<script src="${WIDGET_HOST}/widget/asmos-widget.js"\n  data-asmos-key="${siteKey}"\n  async defer>\n</script>`;
}

export default function ConnectStorePage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("shopify");
  const [copied, setCopied] = useState(false);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    // Load the account's website ID to use as site key
    fetch("/api/account")
      .then((r) => r.json())
      .then((data) => {
        const websiteId = data?.websites?.[0]?.id;
        if (websiteId) setSiteKey(websiteId);
        if (data?.websites?.[0]?.installVerified) setVerified(true);
      })
      .catch(() => {});
  }, []);

  const SNIPPET = buildSnippet(siteKey ?? "YOUR_SITE_KEY");
  const activeTab = TABS.find((t) => t.id === tab)!;

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  async function verifyInstall() {
    if (!siteKey) return;
    setVerifying(true);
    setVerifyError(null);
    try {
      const res = await fetch(`/api/websites/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId: siteKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.verified) {
        setVerified(true);
      } else {
        setVerifyError(
          "Snippet not detected yet. Make sure you saved the file and the page has loaded.",
        );
      }
    } catch {
      setVerifyError("Could not check. Try again in a moment.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleDone() {
    onboardingStepCompleted(4, "connect-store");
    router.push("/onboarding/generate-popup");
  }

  return (
    <div className="flex flex-col gap-6 animate-page-enter">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
          Connect your store
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
          Add the Asmos snippet to your site to start tracking and showing
          popups.
        </p>
      </div>

      {/* Platform tabs */}
      <div
        className="flex gap-1 rounded-lg bg-[color:var(--color-surface-sunken)] p-1"
        role="tablist"
        aria-label="Platform"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={[
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer",
              tab === t.id
                ? "bg-[color:var(--color-surface)] text-[color:var(--color-text-primary)] shadow-sm"
                : "text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Snippet code block */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-[color:var(--color-text-primary)]">
            Your snippet
          </p>
          <button
            onClick={copySnippet}
            className={[
              "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 cursor-pointer",
              copied
                ? "bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]"
                : "bg-[color:var(--color-surface-sunken)] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]",
            ].join(" ")}
            aria-label="Copy snippet"
          >
            {copied ? (
              <>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="6" y="6" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M10 6V4a1.5 1.5 0 00-1.5-1.5H4A1.5 1.5 0 002.5 4v4.5A1.5 1.5 0 004 10h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Copy snippet
              </>
            )}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-lg bg-[color:var(--color-text-primary)] p-4 text-xs leading-relaxed text-[#e2e8f0] font-mono select-all">
          <code>{SNIPPET}</code>
        </pre>
      </div>

      {/* Instructions */}
      <div>
        <p className="mb-2 text-sm font-medium text-[color:var(--color-text-primary)]">
          How to install
        </p>
        <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-4">
          <ol className="flex flex-col gap-2">
            {activeTab.instructions.split("\n").map((line, i) => (
              <li key={i} className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed">
                {line}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Install verification */}
      {verified ? (
        <div className="flex items-center gap-2 rounded-lg border border-[color:var(--color-success-bg)] bg-[color:var(--color-success-bg)] px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8l3.5 3.5L13 4.5" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-sm font-medium text-[color:var(--color-success)]">Snippet detected and verified.</p>
        </div>
      ) : (
        <div>
          <button
            onClick={verifyInstall}
            disabled={verifying || !siteKey}
            className="flex items-center gap-2 text-sm font-medium text-[color:var(--color-primary)] hover:underline disabled:opacity-50 cursor-pointer"
          >
            {verifying ? (
              <>
                <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-[color:var(--color-primary-light)] border-t-[color:var(--color-primary)]" style={{ animation: "spin .8s linear infinite" }} aria-hidden="true" />
                Checking...
              </>
            ) : (
              "Verify installation"
            )}
          </button>
          {verifyError && (
            <p className="mt-1.5 text-xs text-[color:var(--color-text-secondary)]">{verifyError}</p>
          )}
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      <div className="flex flex-col gap-3 pt-1">
        <div className="flex justify-between gap-3">
          <Button href="/onboarding/testing-strategy" variant="secondary">
            Back
          </Button>
          <Button onClick={handleDone}>
            {verified ? "Continue to your popup" : "I've installed it"}
          </Button>
        </div>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="w-full rounded-lg py-2.5 text-sm font-medium text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] transition-colors duration-150 text-center"
          aria-label="Skip installation for now"
        >
          Skip for now, go to dashboard
        </button>
      </div>
    </div>
  );
}

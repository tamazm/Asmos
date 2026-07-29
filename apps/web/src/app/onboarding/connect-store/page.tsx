"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

const SNIPPET = `<script src="https://widget.asmos.io/v1/loader.js"
  data-asmos-key="YOUR_SITE_KEY"
  async defer>
</script>`;

const SHOPIFY_INSTRUCTIONS = `1. In your Shopify admin, go to Online Store → Themes
2. Click "Edit code" on your active theme
3. Open layout/theme.liquid
4. Paste the snippet just before the closing </head> tag
5. Save the file`;

const WORDPRESS_INSTRUCTIONS = `1. In your WordPress dashboard, go to Appearance → Theme Editor
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

export default function ConnectStorePage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("shopify");
  const [copied, setCopied] = useState(false);

  const activeTab = TABS.find((t) => t.id === tab)!;

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the textarea
    }
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
      <div>
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
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150 cursor-pointer",
                tab === t.id
                  ? "bg-[color:var(--color-surface)] text-[color:var(--color-text-primary)] shadow-sm"
                  : "text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>
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
              "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all duration-150 cursor-pointer",
              copied
                ? "bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]"
                : "bg-[color:var(--color-surface-sunken)] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]",
            ].join(" ")}
            aria-label="Copy snippet"
          >
            {copied ? (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 8l3.5 3.5L13 4.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="6"
                    y="6"
                    width="8"
                    height="8"
                    rx="1.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M10 6V4a1.5 1.5 0 00-1.5-1.5H4A1.5 1.5 0 002.5 4v4.5A1.5 1.5 0 004 10h2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-xl bg-[color:var(--color-text-primary)] p-4 text-xs leading-relaxed text-[#e2e8f0] font-mono select-all">
          <code>{SNIPPET}</code>
        </pre>
      </div>

      {/* Instructions */}
      <div>
        <p className="mb-2 text-sm font-medium text-[color:var(--color-text-primary)]">
          How to install
        </p>
        <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-4">
          <ol className="flex flex-col gap-2">
            {activeTab.instructions.split("\n").map((line, i) => (
              <li
                key={i}
                className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed"
              >
                {line}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="flex justify-between gap-3 pt-1">
        <Button href="/onboarding/consent" variant="secondary">
          Back
        </Button>
        <Button onClick={() => router.push("/dashboard")}>
          I&apos;ve installed it
        </Button>
      </div>
    </div>
  );
}

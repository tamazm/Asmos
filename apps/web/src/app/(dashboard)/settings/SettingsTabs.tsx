"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function SettingsTabs({
  tabs,
}: {
  tabs: { key: string; label: string; content: ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0].key);
  const activeTab = tabs.find((t) => t.key === active);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div
        className="flex flex-wrap gap-x-1 border-b border-[color:var(--color-border)]"
        role="tablist"
        aria-label="Settings sections"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active === tab.key}
            onClick={() => setActive(tab.key)}
            className={cn(
              "-mb-px min-h-11 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150 cursor-pointer sm:px-4",
              active === tab.key
                ? "border-[color:var(--color-primary)] text-[color:var(--color-primary)]"
                : "border-transparent text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="min-w-0">{activeTab?.content}</div>
    </div>
  );
}

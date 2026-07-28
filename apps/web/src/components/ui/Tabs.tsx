"use client";

import { cn } from "@/lib/cn";

export type Tab = { key: string; label: string };

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-6 overflow-x-auto border-b border-[color:var(--color-border)]">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              "relative shrink-0 whitespace-nowrap pb-3 text-sm font-medium transition-colors",
              isActive
                ? "text-[color:var(--color-primary)]"
                : "text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]",
            )}
          >
            {tab.label}
            {isActive && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[color:var(--color-primary)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}

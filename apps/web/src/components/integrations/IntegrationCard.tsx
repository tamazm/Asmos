"use client";

import React from "react";
import { cn } from "@/lib/cn";

export type IntegrationStatus = "connected" | "reconnect" | "disconnected";

export interface IntegrationCardProps {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: React.ReactNode;
  status: IntegrationStatus;
  activeEventsCount?: number;
  lastDelivery?: { status: string; at: string } | null;
  onClick: () => void;
}

export function IntegrationCard({
  name,
  category,
  description,
  icon,
  status,
  activeEventsCount,
  onClick,
}: IntegrationCardProps) {
  const isConnected = status === "connected";
  const isReconnect = status === "reconnect";

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 text-left transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-[color:var(--color-primary)]/40 hover:shadow-md cursor-pointer",
        isConnected && "border-[color:var(--color-border)]/80 shadow-xs",
        isReconnect && "border-amber-300 bg-amber-500/[0.02]"
      )}
    >
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-surface-sunken)] p-1.5 transition-transform duration-200 group-hover:scale-105">
              {icon}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-[color:var(--color-text-primary)] group-hover:text-[color:var(--color-primary)] transition-colors">
                {name}
              </h3>
              <span className="block truncate text-xs text-[color:var(--color-text-secondary)]">
                {category}
              </span>
            </div>
          </div>

          {/* Status Badge */}
          <div className="shrink-0">
            {isConnected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-success-bg)] px-2.5 py-1 text-xs font-medium text-[color:var(--color-success)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)] animate-pulse" />
                Connected
              </span>
            ) : isReconnect ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Reconnect
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-[color:var(--color-neutral-badge)] px-2.5 py-1 text-xs font-medium text-[color:var(--color-text-secondary)]">
                Not connected
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="mt-3.5 text-xs leading-relaxed text-[color:var(--color-text-secondary)] line-clamp-2">
          {description}
        </p>
      </div>

      {/* Bottom Action Row */}
      <div className="mt-5 flex items-center justify-between border-t border-[color:var(--color-border)]/70 pt-3.5">
        <div className="min-w-0">
          {isConnected && typeof activeEventsCount === "number" && activeEventsCount > 0 ? (
            <span className="text-[11px] font-medium text-[color:var(--color-text-secondary)]">
              {activeEventsCount} {activeEventsCount === 1 ? "event" : "events"} active
            </span>
          ) : isConnected ? (
            <span className="text-[11px] font-medium text-[color:var(--color-success)]">
              Ready
            </span>
          ) : isReconnect ? (
            <span className="text-[11px] font-medium text-amber-600">
              Needs token
            </span>
          ) : (
            <span className="text-[11px] text-[color:var(--color-text-secondary)] opacity-70">
              Available
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer select-none",
            isConnected
              ? "border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-primary)] hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)] hover:bg-[color:var(--color-surface-sunken)]"
              : isReconnect
              ? "bg-amber-500 text-white hover:bg-amber-600 shadow-xs"
              : "border border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)] text-[color:var(--color-primary)] hover:bg-[color:var(--color-primary)] hover:text-white"
          )}
        >
          {isConnected ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Configure
            </>
          ) : isReconnect ? (
            "Reconnect"
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Connect
            </>
          )}
        </button>
      </div>
    </div>
  );
}

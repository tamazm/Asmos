"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import Image from "next/image";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    href: "/campaigns",
    label: "Pop-ups",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2 12L5.5 8.5L8 11L11 7L14 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 14h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/leads",
    label: "Leads",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/reports",
    label: "Reports",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2" y="1.5" width="12" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 5.5h6M5 8h6M5 10.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/integrations",
    label: "Integrations",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="3.5" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12.5" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5.5 8h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 5.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.1 3.1l1.05 1.05M11.85 11.85l1.05 1.05M3.1 12.9l1.05-1.05M11.85 4.15l1.05-1.05" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function Sidebar({ businessName, userEmail }: { businessName?: string; userEmail?: string | null }) {
  const pathname = usePathname();

  const isSuperadmin = userEmail === "zaridzezurabi@gmail.com" || userEmail === "test@asmos.dev";

  return (
    <aside className="flex h-full w-56 flex-shrink-0 flex-col border-r border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
      {/* Logo area */}
      <div className="flex h-14 items-center border-b border-[color:var(--color-border)] px-4">
        <Image
          src="/assets/asmos-logo-primary-lightbg.webp"
          alt="Asmos"
          width={100}
          height={25}
          priority
          className="h-6 w-auto"
        />
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-3">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname?.startsWith(`${item.href}/`);
          
          let displayLabel = item.label;
          if (active && pathname && pathname !== item.href) {
            const parts = pathname.replace(item.href, "").split("/").filter(Boolean);
            if (parts.length > 0) {
              if (parts.length === 1) {
                displayLabel = `${item.label} / Overview`;
              } else {
                const subPage = parts[parts.length - 1];
                const capitalized = subPage.charAt(0).toUpperCase() + subPage.slice(1);
                displayLabel = `${item.label} / ${capitalized}`;
              }
            }
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-[background-color,color] duration-200",
                active
                  ? "bg-[color:var(--color-primary-light)] text-[color:var(--color-primary)]"
                  : "text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-sunken)] hover:text-[color:var(--color-text-primary)]",
              )}
              aria-current={active ? "page" : undefined}
            >
              {item.icon}
              <span className="truncate">{displayLabel}</span>
              {active && (
                <span
                  className="ml-auto h-1.5 w-1.5 rounded-full bg-[color:var(--color-primary)] flex-shrink-0"
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}
        {isSuperadmin && (
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-[background-color,color] duration-200 mt-4",
              pathname === "/admin"
                ? "bg-[color:var(--color-primary-light)] text-[color:var(--color-primary)]"
                : "text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-sunken)] hover:text-[color:var(--color-text-primary)]",
            )}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2L14 5V11L8 14L2 11V5L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 14V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 5L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 5L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Superadmin
          </Link>
        )}
      </nav>

      {/* Footer hint — Double-Bezel callout */}
      <div className="px-3 py-3 border-t border-[color:var(--color-border)] flex flex-col gap-2.5">
        {/* Workspace section */}
        {businessName && (
          <div className="flex items-center gap-2 px-1 py-1">
            <div
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[6px] text-[10px] font-bold text-white"
              style={{ backgroundColor: "#165DFF" }}
              aria-hidden="true"
            >
              {businessName.charAt(0).toUpperCase()}
            </div>
            <span className="truncate text-xs font-medium text-[color:var(--color-text-primary)]">
              {businessName}
            </span>
          </div>
        )}
        {/* Outer shell */}
        <div className="rounded-[1rem] border border-[color:var(--color-primary)]/20 bg-[color:var(--color-primary-light)] p-1">
          {/* Inner core */}
          <div
            className="rounded-[0.625rem] bg-[color:var(--color-primary-light)] px-3 py-2.5"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)" }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)] animate-pulse" aria-hidden="true" />
              <p className="text-xs font-semibold text-[color:var(--color-primary)]">
                AI is optimizing
              </p>
            </div>
            <p className="text-xs text-[color:var(--color-text-secondary)] leading-relaxed">
              Traffic routes to your best variant automatically.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import Image from "next/image";
import { UserButton } from "@/components/ui/MockUserButton";

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
    href: "/rewards",
    label: "Rewards",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1.5" y="6" width="13" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M1.5 9h13" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 6v8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 6c-1.5 0-2.5-.9-2.5-2S6.2 2.5 7 3c.6.4 1 1.3 1 3zM8 6c1.5 0 2.5-.9 2.5-2S9.8 2.5 9 3c-.6.4-1 1.3-1 3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
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

export function Sidebar({
  businessName,
  isSuperadmin = false,
  userName,
  userEmail,
  userVerified = false,
  onNavigate,
}: {
  businessName?: string;
  isSuperadmin?: boolean;
  userName?: string;
  userEmail?: string;
  /** True when at least one of the account's sites has a verified install. */
  userVerified?: boolean;
  /** Called when a nav link is clicked — closes the mobile overlay, if open. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 max-w-[calc(100vw_-_2rem)] flex-shrink-0 flex-col border-r border-[color:var(--color-border)] bg-[color:var(--color-surface)] lg:w-56 lg:max-w-none">
      {/* Logo area — height matches the top bar so the two align across the seam */}
      <div className="flex h-20 items-center justify-between gap-2 border-b border-[color:var(--color-border)] px-4">
        <Image
          src="/assets/logo.webp"
          alt="Asmos"
          width={119}
          height={25}
          priority
          className="h-6 w-auto max-w-[calc(100%_-_2.25rem)]"
        />
        <Link
          href="/settings"
          onClick={onNavigate}
          title={businessName ? `${businessName} workspace` : "Workspace settings"}
          aria-label={businessName ? `${businessName} workspace settings` : "Workspace settings"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[color:var(--color-border)] text-[color:var(--color-text-secondary)] transition-colors duration-200 hover:bg-[color:var(--color-surface-sunken)] hover:text-[color:var(--color-text-primary)]"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M3.5 4.5 6 2l2.5 2.5M3.5 7.5 6 10l2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3">
        <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-text-secondary)]">
          Main
        </p>
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
              onClick={onNavigate}
              className={cn(
                "flex min-h-10 min-w-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-[background-color,color] duration-200",
                active
                  ? "bg-[color:var(--color-primary-light)] text-[color:var(--color-primary)]"
                  : "text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-sunken)] hover:text-[color:var(--color-text-primary)]",
              )}
              aria-current={active ? "page" : undefined}
            >
              {item.icon}
              <span className="min-w-0 truncate">{displayLabel}</span>
              {active && (
                <span
                  className="ml-auto h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[color:var(--color-primary)]"
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}
        {isSuperadmin && (
          <Link
            href="/admin"
            onClick={onNavigate}
            className={cn(
              "mt-4 flex min-h-10 min-w-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-[background-color,color] duration-200",
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
            <span className="min-w-0 truncate">Superadmin</span>
          </Link>
        )}
      </nav>

      {/* Account row — avatar opens the account menu, the rest opens settings */}
      <div className="border-t border-[color:var(--color-border)] px-3 py-3">
        <div className="flex items-center gap-2.5">
          <UserButton />
          <Link
            href="/settings"
            onClick={onNavigate}
            className="group -mx-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 transition-colors duration-200 hover:bg-[color:var(--color-surface-sunken)]"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1">
                <span className="truncate text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                  {userName ?? businessName ?? "Account"}
                </span>
                {userVerified && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 14 14"
                    fill="none"
                    className="shrink-0 text-[color:var(--color-primary)]"
                    role="img"
                    aria-label="Install verified"
                  >
                    <circle cx="7" cy="7" r="6.25" fill="currentColor" />
                    <path d="M4.5 7.2 6.2 8.9 9.6 5.4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              {userEmail && (
                <span className="block truncate text-[11px] text-[color:var(--color-text-secondary)]">
                  {userEmail}
                </span>
              )}
            </span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
              className="shrink-0 text-[color:var(--color-text-secondary)] transition-transform duration-200 group-hover:translate-x-0.5"
            >
              <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>
    </aside>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Toaster } from "react-hot-toast";
import { Sidebar } from "@/components/ui/Sidebar";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { TopBarGreeting } from "@/components/ui/TopBarGreeting";
import { IconPlus } from "@/components/dashboard/icons";
import { cn } from "@/lib/cn";

export function DashboardShell({
  businessName,
  isSuperadmin,
  userName,
  userEmail,
  userVerified,
  displayName,
  imageUrl,
  children,
}: {
  businessName?: string;
  isSuperadmin: boolean;
  userName?: string;
  userEmail?: string;
  userVerified: boolean;
  displayName: string;
  imageUrl?: string | null;
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  // Lock outer html/body scroll so only the inner <main> can scroll.
  // Prevents the browser from ever scrolling the outer window down when inputs/radios are focused.
  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    window.scrollTo(0, 0);

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-[color:var(--color-surface-sunken)]">
      <Toaster position="bottom-right" toastOptions={{ duration: 4000 }} />

      {/* Mobile backdrop - clicking it closes the nav overlay */}
      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: slide-in overlay on mobile, static in-flow on lg+ */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 shadow-2xl transition-transform duration-200 ease-out",
          "lg:static lg:z-auto lg:shadow-none lg:translate-x-0 lg:h-full lg:shrink-0",
          navOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Sidebar
          businessName={businessName}
          isSuperadmin={isSuperadmin}
          userName={userName}
          userEmail={userEmail}
          userVerified={userVerified}
          onNavigate={() => setNavOpen(false)}
        />
      </div>

      <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden h-full">
        {/* Top bar */}
        <header className="flex h-20 shrink-0 items-center justify-between gap-3 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setNavOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-sunken)] transition-colors duration-150 cursor-pointer lg:hidden"
              aria-label="Open menu"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <TopBarGreeting name={displayName} imageUrl={imageUrl} />
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <NotificationBell />
            <Link
              href="/campaigns/new"
              className="hidden sm:inline-flex h-10 items-center gap-1.5 rounded-lg bg-[color:var(--color-primary)] px-4 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]"
            >
              <IconPlus />
              Create Pop-up
            </Link>
            <Link
              href="/campaigns/new"
              aria-label="Create Pop-up"
              className="inline-flex sm:hidden h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--color-primary)] text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]"
            >
              <IconPlus />
            </Link>
          </div>
        </header>
        {/* Page content */}
        <main className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto px-3 py-4 sm:px-4 sm:py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}

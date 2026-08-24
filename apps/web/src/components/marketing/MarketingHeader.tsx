"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { MAIN_NAV, CTA } from "@/lib/site";

/**
 * Shared header for all marketing/public pages. Desktop (lg+) shows the
 * full horizontal nav; below that, nav links and "Log in" collapse into a
 * hamburger-triggered panel so there's always a way to reach every page,
 * not just the ones that fit in a compact bar.
 */
export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile panel on route change and lock body scroll while open.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const navLinks = MAIN_NAV.filter((item) => item.label !== "Home");

  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Link href="/" aria-label="Asmos home" className="shrink-0">
          <Image
            src="/assets/logo.webp"
            alt="Asmos"
            width={133}
            height={28}
            priority
            className="h-8 w-auto"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 text-sm font-medium text-[color:var(--color-text-secondary)] lg:flex">
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors duration-200 hover:text-[color:var(--color-text-primary)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 text-sm font-medium">
          {/* Desktop-only secondary/primary CTAs */}
          <Link
            href="/sign-in"
            className="hidden text-[color:var(--color-text-secondary)] transition-colors duration-200 hover:text-[color:var(--color-text-primary)] lg:block"
          >
            Log in
          </Link>
          <Link
            href={CTA.primary.href}
            className="rounded-full bg-[color:var(--color-primary)] px-3.5 py-2 text-xs sm:px-4 sm:text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97] whitespace-nowrap"
          >
            {CTA.primary.label}
          </Link>

          {/* Hamburger — everything below lg */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav-panel"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:var(--color-border)] text-[color:var(--color-text-primary)] transition-colors duration-150 hover:bg-[color:var(--color-surface-sunken)] lg:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              {open ? (
                <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {open && (
        <div
          id="mobile-nav-panel"
          className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)] lg:hidden"
          style={{ animation: "mobile-nav-in 160ms var(--ease-out-quart, ease-out) both" }}
        >
          <style>{`@keyframes mobile-nav-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
          <nav className="flex flex-col px-5 py-2">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-[color:var(--color-border)] py-3.5 text-base font-medium text-[color:var(--color-text-primary)] last:border-b-0"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-2.5 px-5 pb-6 pt-3">
            <Link
              href="/sign-in"
              onClick={() => setOpen(false)}
              className="w-full rounded-full border border-[color:var(--color-border)] py-2.5 text-center text-sm font-semibold text-[color:var(--color-text-primary)] transition-colors duration-150 hover:bg-[color:var(--color-surface-sunken)]"
            >
              Log in
            </Link>
            <Link
              href={CTA.primary.href}
              onClick={() => setOpen(false)}
              className="w-full rounded-full bg-[color:var(--color-primary)] py-2.5 text-center text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]"
            >
              {CTA.primary.label}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

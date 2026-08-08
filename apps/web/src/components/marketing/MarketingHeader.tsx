import Link from "next/link";
import Image from "next/image";
import { MAIN_NAV, CTA } from "@/lib/site";

/**
 * Shared header for all marketing/public pages. Keeps nav + CTA hierarchy
 * (Start Free Trial primary, Log in secondary-ghost) consistent site-wide.
 */
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Link href="/" aria-label="Asmos home">
          <Image
            src="/assets/asmos-logo-primary-lightbg.webp"
            alt="Asmos"
            width={110}
            height={28}
            priority
            className="h-8 w-auto"
          />
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-[color:var(--color-text-secondary)] lg:flex">
          {MAIN_NAV.filter((item) => item.label !== "Home").map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors duration-200 hover:text-[color:var(--color-text-primary)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm font-medium">
          <Link
            href="/sign-in"
            className="hidden text-[color:var(--color-text-secondary)] transition-colors duration-200 hover:text-[color:var(--color-text-primary)] sm:block"
          >
            Log in
          </Link>
          <Link
            href={CTA.primary.href}
            className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]"
          >
            {CTA.primary.label}
          </Link>
        </div>
      </div>
    </header>
  );
}

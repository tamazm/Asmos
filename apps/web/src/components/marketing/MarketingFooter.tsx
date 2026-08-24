import Link from "next/link";
import Image from "next/image";
import { FOOTER_LINKS } from "@/lib/site";
import { ScrollReveal } from "./ScrollReveal";

export function MarketingFooter() {
  return (
    <footer className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-5 py-14">
      <ScrollReveal />
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Image
              src="/assets/logo.webp"
              alt="Asmos"
              width={114}
              height={24}
              className="h-6 w-auto"
            />
            <p className="mt-3 text-xs text-[color:var(--color-text-secondary)] leading-relaxed max-w-[180px]">
              AI conversion optimization for ecommerce.
            </p>
          </div>
          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div key={heading}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-primary)]">
                {heading}
              </p>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-xs text-[color:var(--color-text-secondary)] transition-colors duration-200 hover:text-[color:var(--color-text-primary)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[color:var(--color-border)] pt-6 text-xs text-[color:var(--color-text-secondary)] sm:flex-row">
          <span>&copy; {new Date().getFullYear()} Asmos</span>
          <span>Made for ecommerce teams focused on measurable growth.</span>
        </div>
      </div>
    </footer>
  );
}

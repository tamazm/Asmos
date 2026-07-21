"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/campaigns", label: "Pop-ups" },
  { href: "/analytics", label: "Analytics" },
  { href: "/leads", label: "Leads" },
  { href: "/integrations", label: "Integrations" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-56 flex-col border-r border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[color:var(--color-primary)] text-sm font-bold text-white">
          A
        </span>
        <span className="text-lg font-semibold text-[color:var(--color-text-primary)]">
          asmos
        </span>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-[color:var(--color-primary-light)] text-[color:var(--color-primary)]"
                  : "text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-sunken)]",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

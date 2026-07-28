"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Logo } from "./Logo";
import { CalloutCard } from "./CalloutCard";

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
      <Logo className="mb-6 px-2" />
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

      <div className="mt-auto flex flex-col gap-3 pt-4">
        <CalloutCard
          icon={<span aria-hidden="true">✨</span>}
          title="AI is optimizing"
          message="Asmos is allocating traffic to the best performing variants."
          action={
            <Link
              href="/campaigns"
              className="text-xs font-medium text-[color:var(--color-primary)] hover:underline"
            >
              Learn more
            </Link>
          }
        />
        <CalloutCard
          icon={<span aria-hidden="true">🎧</span>}
          title="Need help?"
          message="Contact support"
        />
      </div>
    </aside>
  );
}

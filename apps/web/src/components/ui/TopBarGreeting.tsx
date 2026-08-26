"use client";

import { usePathname } from "next/navigation";

const SECTION_LABELS: { prefix: string; label: string }[] = [
  { prefix: "/campaigns", label: "Pop-ups" },
  { prefix: "/analytics", label: "Analytics" },
  { prefix: "/leads", label: "Leads" },
  { prefix: "/rewards", label: "Rewards" },
  { prefix: "/reports", label: "Reports" },
  { prefix: "/integrations", label: "Integrations" },
  { prefix: "/settings", label: "Settings" },
  { prefix: "/admin", label: "Admin" },
  { prefix: "/superadmin", label: "Superadmin" },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Identity block at the left of the top bar. On the dashboard it greets;
 * everywhere else it names the section, so the same slot stays useful instead
 * of welcoming someone who has been in the app for an hour.
 */
export function TopBarGreeting({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  const pathname = usePathname() ?? "";
  const section = SECTION_LABELS.find((entry) => pathname.startsWith(entry.prefix));
  const subtitle = section ? section.label : "Welcome back to Asmos";

  return (
    <div className="flex min-w-0 items-center gap-3">
      {imageUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={imageUrl}
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-[color:var(--color-border)]"
        />
      ) : (
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-sm font-semibold text-white"
          aria-hidden="true"
        >
          {initials(name)}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-xl font-bold leading-tight tracking-tight text-[color:var(--color-text-primary)]">
          {name}
        </p>
        <p className="truncate text-[13px] leading-tight text-[color:var(--color-text-secondary)]">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

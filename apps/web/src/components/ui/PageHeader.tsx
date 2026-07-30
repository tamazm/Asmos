import Link from "next/link";
import { Badge } from "./Badge";

export function PageHeader({
  title,
  backHref,
  backLabel,
  status,
  actions,
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
  status?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 pb-5">
      <div>
        {backHref && (
          <Link
            href={backHref}
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-[color:var(--color-text-secondary)] transition-colors duration-200 hover:text-[color:var(--color-text-primary)]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M9 2.5L4.5 7 9 11.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {backLabel}
          </Link>
        )}
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
            {title}
          </h1>
          {status && <Badge variant="success">{status}</Badge>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

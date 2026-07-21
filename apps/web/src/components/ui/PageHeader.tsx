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
    <div className="flex items-start justify-between gap-4 border-b border-[color:var(--color-border)] pb-4">
      <div>
        {backHref && (
          <Link
            href={backHref}
            className="mb-2 inline-flex items-center gap-1 text-sm text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
          >
            ← {backLabel}
          </Link>
        )}
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-[color:var(--color-text-primary)]">
            {title}
          </h1>
          {status && <Badge variant="success">{status}</Badge>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

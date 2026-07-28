import type { ReactNode } from "react";

export function CalloutCard({
  icon,
  title,
  message,
  action,
}: {
  icon: ReactNode;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-[color:var(--color-primary)]">{icon}</span>
        <div>
          <p className="text-xs font-semibold text-[color:var(--color-text-primary)]">{title}</p>
          <p className="mt-0.5 text-xs text-[color:var(--color-text-secondary)]">{message}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

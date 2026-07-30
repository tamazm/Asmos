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
    /* Double-Bezel outer shell */
    <div className="rounded-[1.125rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1">
      {/* Inner core */}
      <div
        className="flex flex-col gap-2 rounded-[0.75rem] bg-[color:var(--color-surface)] px-3 py-3"
        style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)" }}
      >
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 shrink-0 text-[color:var(--color-primary)]">{icon}</span>
          <div>
            <p className="text-xs font-semibold text-[color:var(--color-text-primary)]">{title}</p>
            <p className="mt-0.5 text-xs text-[color:var(--color-text-secondary)] leading-relaxed">{message}</p>
          </div>
        </div>
        {action}
      </div>
    </div>
  );
}

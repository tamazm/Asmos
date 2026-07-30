import { cn } from "@/lib/cn";

type BadgeVariant = "success" | "neutral" | "warning" | "error";

const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]",
  neutral: "bg-[color:var(--color-neutral-badge)] text-[color:var(--color-text-secondary)]",
  warning: "bg-amber-50 text-amber-700",
  error: "bg-red-50 text-red-600",
};

export function Badge({
  children,
  variant = "neutral",
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
    >
      {(variant === "success" || variant === "warning" || variant === "error") && (
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      )}
      {children}
    </span>
  );
}

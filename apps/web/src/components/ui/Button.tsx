import Link from "next/link";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[color:var(--color-primary)] text-white hover:bg-[color:var(--color-primary-dark)]",
  secondary:
    "border border-[color:var(--color-border)] text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)]",
};

const baseClasses =
  "inline-flex items-center justify-center rounded-lg h-10 px-4 py-2 text-sm font-medium transition-colors duration-150 active:scale-[0.98]";

export function Button({
  children,
  variant = "primary",
  href,
  type = "button",
  className,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  variant?: ButtonVariant;
  href?: string;
  type?: "button" | "submit";
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const classes = cn(baseClasses, variantClasses[variant], className);

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}

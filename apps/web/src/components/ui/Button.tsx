import Link from "next/link";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[color:var(--color-primary)] text-white hover:bg-[color:var(--color-primary-dark)]",
  secondary:
    "border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)]",
  ghost:
    "text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)]",
};

// Custom fluid easing; falls back to ease-out in environments that don't parse CSS vars in transition
const baseClasses =
  "group inline-flex items-center justify-center gap-2 rounded-lg h-10 px-4 py-2 text-sm font-medium " +
  "transition-[background-color,color,transform,box-shadow] duration-200 " +
  "active:scale-[0.97] select-none";

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
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(classes, disabled && "opacity-50 pointer-events-none")}
    >
      {children}
    </button>
  );
}

/**
 * ButtonArrow - a primary button with a "button-in-button" arrow icon.
 * The arrow is nested in its own circular pill, creating internal kinetic tension.
 */
export function ButtonArrow({
  children,
  href,
  type = "button",
  className,
  onClick,
}: {
  children: React.ReactNode;
  href?: string;
  type?: "button" | "submit";
  className?: string;
  onClick?: () => void;
}) {
  const classes = cn(
    "group inline-flex items-center gap-3 rounded-full h-11 pl-5 pr-1.5 text-sm font-semibold " +
      "bg-[color:var(--color-primary)] text-white " +
      "transition-[background-color,transform,box-shadow] duration-300 " +
      "hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97] select-none",
    className,
  );

  const inner = (
    <>
      <span>{children}</span>
      {/* Button-in-button arrow */}
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-105"
        aria-hidden="true"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M2.5 7h9M8 3.5L11.5 7 8 10.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {inner}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} className={classes}>
      {inner}
    </button>
  );
}

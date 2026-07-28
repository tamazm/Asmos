import Image from "next/image";
import { cn } from "@/lib/cn";

export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src="/assets/asmos-logo-icononly-lightbg.webp"
        alt="Asmos"
        width={size}
        height={size}
        priority
      />
      <span className="text-lg font-semibold text-[color:var(--color-text-primary)]">
        asmos
      </span>
    </div>
  );
}

export function StackedLogo({ size = 200, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/assets/asmos-logo-stacked-lightbg.webp"
      alt="Asmos"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}

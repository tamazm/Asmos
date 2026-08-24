import Image from "next/image";
import { cn } from "@/lib/cn";

const LOGO_ASPECT_RATIO = 512 / 108;

export function Logo({ height = 28, className }: { height?: number; className?: string }) {
  return (
    <Image
      src="/assets/logo.webp"
      alt="Asmos"
      width={Math.round(height * LOGO_ASPECT_RATIO)}
      height={height}
      priority
      className={cn("w-auto", className)}
      style={{ height }}
    />
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-[color:var(--color-surface-sunken)] px-6 text-center">
      <Logo />
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-10 shadow-sm max-w-md w-full">
        <div>
          <h1 className="text-4xl font-bold text-[color:var(--color-text-primary)]">404</h1>
          <p className="mt-2 text-[color:var(--color-text-secondary)]">
            This page doesn&apos;t exist or has been moved.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button href="/">Back to home</Button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 h-10 text-sm font-medium text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)] transition-colors duration-150 active:scale-[0.98]"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

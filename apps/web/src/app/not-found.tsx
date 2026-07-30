import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-[color:var(--color-surface-sunken)] px-6 text-center">
      <Logo />
      <div>
        <h1 className="text-4xl font-bold text-[color:var(--color-text-primary)]">404</h1>
        <p className="mt-2 text-[color:var(--color-text-secondary)]">
          This page doesn&apos;t exist.
        </p>
      </div>
      <Button href="/">Back to home</Button>
    </div>
  );
}

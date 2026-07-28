import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-[color:var(--color-border)] px-6 py-4">
        <Logo />
        <div className="flex items-center gap-4 text-sm font-medium">
          <Link href="/sign-in" className="text-[color:var(--color-text-secondary)]">
            Log in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-white hover:bg-[color:var(--color-primary-dark)]"
          >
            Sign up
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-32 text-center">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
          Popups that get smarter with every visitor.
        </h1>
        <p className="max-w-xl text-lg text-[color:var(--color-text-secondary)]">
          Launch on-site popups, capture leads, and let behavioral AI optimize
          every campaign automatically.
        </p>
        <Link
          href="/sign-up"
          className="rounded-lg bg-[color:var(--color-primary)] px-6 py-3 text-base font-medium text-white hover:bg-[color:var(--color-primary-dark)]"
        >
          Get Started
        </Link>
      </main>
    </div>
  );
}

import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { HomepageForm } from "@/components/ui/HomepageForm";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[color:var(--color-surface)]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[color:var(--color-border)] px-6 py-4 bg-[color:var(--color-surface)]">
        <Image
          src="/assets/asmos-logo-primary-lightbg.webp"
          alt="Asmos"
          width={110}
          height={28}
          priority
          className="h-7 w-auto"
        />
        <div className="flex items-center gap-3 text-sm font-medium">
          <Link
            href="/sign-in"
            className="text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] transition-colors duration-150 px-3 py-1.5"
          >
            Log in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-white hover:bg-[color:var(--color-primary-dark)] transition-colors duration-150 active:scale-[0.98]"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20">
        {/* Ambient glow behind content */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(22,93,255,0.06) 0%, transparent 70%)",
          }}
        />

        <div className="relative w-full max-w-2xl text-center animate-page-enter">
          {/* Eyebrow badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-text-secondary)] shadow-sm animate-page-enter-delay-1">
            <span
              className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)]"
              aria-hidden="true"
            />
            AI-powered popup optimization
          </div>

          <h1
            className="mb-4 text-4xl font-bold tracking-tight text-[color:var(--color-text-primary)] sm:text-5xl animate-page-enter-delay-1"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Turn visitors into leads, automatically.
          </h1>

          <p
            className="mb-10 text-lg text-[color:var(--color-text-secondary)] leading-relaxed animate-page-enter-delay-2"
            style={{ textWrap: "pretty" } as React.CSSProperties}
          >
            Paste your store URL and Asmos will analyze your brand, then build
            popups that optimize themselves.
          </p>

          <HomepageForm />
        </div>

        {/* Trust strip */}
        <p className="mt-12 text-xs text-[color:var(--color-text-secondary)] animate-page-enter-delay-3">
          No credit card required &nbsp;&middot;&nbsp; Free to start
          &nbsp;&middot;&nbsp; 2-minute setup
        </p>
      </main>
    </div>
  );
}

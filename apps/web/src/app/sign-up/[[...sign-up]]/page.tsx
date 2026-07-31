"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@clerk/nextjs";

const isMock = process.env.NEXT_PUBLIC_MOCK_AUTH === "true";

const RealSignUp = dynamic(
  () => import("@clerk/nextjs").then((m) => ({ default: m.SignUp })),
  { ssr: false },
);

function MockSignUpForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    router.push("/onboarding");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-[color:var(--color-text-primary)] mb-1.5">
          Full name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Smith"
          required
          className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-secondary)] outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-[color:var(--color-text-primary)] mb-1.5">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-secondary)] outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-[color:var(--color-text-primary)] mb-1.5">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Create a password"
          required
          minLength={8}
          className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-secondary)] outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="mt-1 w-full rounded-lg bg-[color:var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors duration-150 disabled:opacity-60"
      >
        {loading ? "Creating account..." : "Create account"}
      </button>
      <p className="text-center text-[11px] text-[color:var(--color-text-secondary)]">
        By continuing, you agree to our{" "}
        <Link href="/terms" className="underline hover:text-[color:var(--color-text-primary)]">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-[color:var(--color-text-primary)]">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}

export default function SignUpPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  // Clerk correctly renders no form when already signed in — but nothing
  // was sending the user anywhere in that case, leaving this page stuck.
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/dashboard");
    }
  }, [isLoaded, isSignedIn, router]);

  const storeName = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem("asmos_analyze_result");
      if (raw) {
        const data = JSON.parse(raw);
        return data.storeName ?? null;
      }
    } catch {
      // ignore
    }
    return null;
  })[0];

  const analyzeResult = useState<{ grade?: string; score?: number } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem("asmos_analyze_result");
      if (raw) {
        const data = JSON.parse(raw);
        if (data.grade || data.score != null) {
          return { grade: data.grade, score: data.score };
        }
      }
    } catch {
      // ignore
    }
    return null;
  })[0];

  const fromAnalyze = analyzeResult !== null;

  // storeName is initialized lazily from sessionStorage (see useState initializer above)

  if (isLoaded && isSignedIn) {
    return null;
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[color:var(--color-surface-sunken)] px-6 py-12">
      <div className="w-full max-w-sm animate-page-enter">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <Image
            src="/assets/asmos-logo-stacked-lightbg.webp"
            alt="Asmos"
            width={80}
            height={80}
            priority
            className="h-16 w-auto"
          />
        </div>

        {/* Heading */}
        <div className="mb-6 text-center animate-page-enter-delay-1">
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
            {storeName
              ? `Unlock ${storeName}'s popup`
              : "Create your account"}
          </h1>
          <p className="mt-1.5 text-sm text-[color:var(--color-text-secondary)]">
            {storeName
              ? "We detected your brand and have your popup ready."
              : "Free to start. Build your first popup in minutes."}
          </p>
        </div>

        {/* What we found summary for analyze-result users */}
        {fromAnalyze && analyzeResult && (analyzeResult.grade || analyzeResult.score != null) && (
          <div className="mb-5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 animate-page-enter-delay-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--color-text-secondary)] mb-2">
              What we found
            </p>
            <div className="flex items-center gap-3">
              {analyzeResult.grade && (
                <span className="text-2xl font-black tabular-nums" style={{
                  color: analyzeResult.grade.startsWith("A") ? "#059669"
                    : analyzeResult.grade.startsWith("B") ? "#2563eb"
                    : analyzeResult.grade.startsWith("C") ? "#d97706"
                    : "#dc2626",
                }}>
                  {analyzeResult.grade}
                </span>
              )}
              <div>
                {analyzeResult.score != null && (
                  <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                    CRO score: {analyzeResult.score}/100
                  </p>
                )}
                <p className="text-xs text-[color:var(--color-text-secondary)]">
                  Your custom popup is ready to publish.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Auth widget */}
        <div className="flex justify-center animate-page-enter-delay-2">
          {isMock ? <MockSignUpForm /> : <RealSignUp />}
        </div>

        <p className="mt-6 text-center text-sm text-[color:var(--color-text-secondary)] animate-page-enter-delay-3">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-[color:var(--color-primary)] hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

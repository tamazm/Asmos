"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, SignIn as RealSignIn } from "@clerk/nextjs";

const isMock = process.env.NEXT_PUBLIC_MOCK_AUTH === "true";

function MockSignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
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
          placeholder="Your password"
          required
          className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-secondary)] outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="mt-1 w-full rounded-lg bg-[color:var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors duration-150 disabled:opacity-60"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

export default function SignInPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  // Clerk correctly renders no form when already signed in — but nothing
  // was sending the user anywhere in that case, leaving this page stuck.
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/dashboard");
    }
  }, [isLoaded, isSignedIn, router]);

  if (isLoaded && isSignedIn) {
    return null;
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[color:var(--color-surface-sunken)] px-6 py-12">
      <div className="w-full max-w-sm animate-page-enter">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <Image
            src="/assets/logo.webp"
            alt="Asmos"
            width={152}
            height={32}
            priority
            className="h-8 w-auto"
          />
        </div>

        {/* Heading */}
        <div className="mb-6 text-center animate-page-enter-delay-1">
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-[color:var(--color-text-secondary)]">
            Sign in to your Asmos account
          </p>
        </div>

        {/* Auth widget */}
        <div className="flex justify-center animate-page-enter-delay-2">
          {isMock ? <MockSignInForm /> : <RealSignIn routing="path" path="/sign-in" />}
        </div>

        <p className="mt-6 text-center text-sm text-[color:var(--color-text-secondary)] animate-page-enter-delay-3">
          New to Asmos?{" "}
          <Link
            href="/sign-up"
            className="font-medium text-[color:var(--color-primary)] hover:underline"
          >
            Create a free account
          </Link>
        </p>
      </div>
    </div>
  );
}

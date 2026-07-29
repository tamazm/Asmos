import Image from "next/image";
import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
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
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-[color:var(--color-text-secondary)]">
            Sign in to your Asmos account
          </p>
        </div>

        {/* Clerk widget */}
        <div className="flex justify-center animate-page-enter-delay-2">
          <SignIn />
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

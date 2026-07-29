import Image from "next/image";
import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
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
            Create your account
          </h1>
          <p className="mt-1.5 text-sm text-[color:var(--color-text-secondary)]">
            Free to start. Build your first popup in minutes.
          </p>
        </div>

        {/* Clerk widget */}
        <div className="flex justify-center animate-page-enter-delay-2">
          <SignUp />
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

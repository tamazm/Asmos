import { auth } from "@clerk/nextjs/server";
import { OnboardingProgress } from "@/components/ui/OnboardingProgress";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await auth.protect();

  return (
    <div className="flex min-h-screen flex-col items-center bg-[color:var(--color-surface-sunken)] px-6 py-12">
      <div className="mb-8 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[color:var(--color-primary)] text-sm font-bold text-white">
          A
        </span>
        <span className="text-lg font-semibold text-[color:var(--color-text-primary)]">
          asmos
        </span>
      </div>

      <div className="mb-10">
        <OnboardingProgress />
      </div>

      <div className="w-full max-w-lg rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-8">
        {children}
      </div>
    </div>
  );
}

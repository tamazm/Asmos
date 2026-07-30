import { authProtect } from "@/lib/auth-adapter";
import { OnboardingProgress } from "@/components/ui/OnboardingProgress";
import { Logo } from "@/components/ui/Logo";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await authProtect();

  return (
    <div className="flex min-h-[100dvh] flex-col items-center bg-[color:var(--color-surface-sunken)] px-6 py-12">
      <Logo className="mb-8" />

      <div className="mb-10">
        <OnboardingProgress />
      </div>

      <div className="w-full max-w-lg rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-8">
        {children}
      </div>
    </div>
  );
}

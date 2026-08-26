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

      {/* Double-Bezel container */}
      <div className="w-full max-w-xl rounded-[1.375rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5 shadow-sm">
        <div
          className="rounded-[1rem] bg-[color:var(--color-surface)] p-8"
          style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.95)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

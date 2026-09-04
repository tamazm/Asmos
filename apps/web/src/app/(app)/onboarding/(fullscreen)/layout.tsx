import { authProtect } from "@/lib/auth-adapter";

export default async function FullscreenOnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await authProtect();

  return (
    <div className="min-h-[100dvh] bg-[color:var(--color-surface-sunken)]">
      {children}
    </div>
  );
}

import { UserButton } from "@/components/ui/MockUserButton";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/ui/Sidebar";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { getOrCreateAccount } from "@/lib/account";
import { authProtect } from "@/lib/auth-adapter";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await authProtect();

  const isMock = process.env.MOCK_AUTH === "true";

  const account = await getOrCreateAccount();
  if (!isMock && !account.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[color:var(--color-surface-sunken)]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6">
          <div />
          <div className="flex items-center gap-3">
            <NotificationBell />
            <UserButton />
          </div>
        </header>
        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}

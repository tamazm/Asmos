import { UserButton } from "@/components/ui/MockUserButton";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/ui/Sidebar";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { getOrCreateAccount } from "@/lib/account";
import { authProtect, currentUser } from "@/lib/auth-adapter";
import { isSuperadminEmail } from "@/lib/superadmin";
import { TesterToolkit } from "@/components/TesterToolkit";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await authProtect();

  const account = await getOrCreateAccount();
  if (!account.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  const user = await currentUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress;
  const isSuperadmin = isSuperadminEmail(userEmail);

  return (
    // `fixed inset-0` (not h-[100dvh]) is deliberate: it pins the shell to
    // the viewport regardless of <body>'s own box height (body is
    // `min-h-full flex flex-col` in the root layout, which can end up
    // slightly taller than the viewport). Sizing this shell to just
    // "h-[100dvh]" let body grow past the viewport in that case, giving a
    // second, outer scrollbar on top of this shell's intentional inner
    // overflow-y-auto on <main> — the "double scroll" bug. Fixed
    // positioning removes this div from document flow entirely, so body's
    // content height collapses to ~0 and can never independently scroll.
    <div className="fixed inset-0 flex overflow-hidden bg-[color:var(--color-surface-sunken)]">
      <Sidebar businessName={account.name} isSuperadmin={isSuperadmin} />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-end border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6">
          <div className="flex items-center gap-3">
            <NotificationBell />
            <UserButton />
          </div>
        </header>
        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
      {isSuperadmin && <TesterToolkit />}
    </div>
  );
}

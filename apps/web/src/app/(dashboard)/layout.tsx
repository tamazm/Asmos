import Link from "next/link";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/ui/Sidebar";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { TopBarGreeting } from "@/components/ui/TopBarGreeting";
import { IconPlus } from "@/components/dashboard/icons";
import { getOrCreateAccount } from "@/lib/account";
import { authProtect, currentUser } from "@/lib/auth-adapter";
import { prisma } from "@/lib/prisma";
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
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    userEmail?.split("@")[0] ||
    account.name;
  // Clerk exposes imageUrl; the mock auth user does not.
  const imageUrl = (user as { imageUrl?: string } | null)?.imageUrl ?? null;
  // The check beside the profile name means something concrete: this account
  // has at least one site with a verified widget install.
  const verifiedSites = await prisma.website.count({
    where: { accountId: account.id, installVerified: true },
  });

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
      <Sidebar
        businessName={account.name}
        isSuperadmin={isSuperadmin}
        userName={displayName}
        userEmail={userEmail}
        userVerified={verifiedSites > 0}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-20 shrink-0 items-center justify-between gap-4 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6">
          <TopBarGreeting name={displayName} imageUrl={imageUrl} />
          <div className="flex shrink-0 items-center gap-3">
            <NotificationBell />
            <Link
              href="/campaigns/new"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[color:var(--color-primary)] px-4 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]"
            >
              <IconPlus />
              Create Pop-up
            </Link>
          </div>
        </header>
        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
      {isSuperadmin && <TesterToolkit />}
    </div>
  );
}

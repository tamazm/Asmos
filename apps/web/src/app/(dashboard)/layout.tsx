import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/ui/DashboardShell";
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

  // `fixed inset-0` (not h-[100dvh]) is deliberate: it pins the shell to
  // the viewport regardless of <body>'s own box height (body is
  // `min-h-full flex flex-col` in the root layout, which can end up
  // slightly taller than the viewport). Sizing this shell to just
  // "h-[100dvh]" let body grow past the viewport in that case, giving a
  // second, outer scrollbar on top of this shell's intentional inner
  // overflow-y-auto on <main> — the "double scroll" bug. Fixed
  // positioning removes this div from document flow entirely, so body's
  // content height collapses to ~0 and can never independently scroll.
  // (DashboardShell owns that fixed-inset-0 wrapper; see that file for the
  // mobile collapsible-sidebar behavior itself.)
  return (
    <DashboardShell
      businessName={account.name}
      isSuperadmin={isSuperadmin}
      userName={displayName}
      userEmail={userEmail}
      userVerified={verifiedSites > 0}
      displayName={displayName}
      imageUrl={imageUrl}
      testerToolkit={isSuperadmin ? <TesterToolkit /> : null}
    >
      {children}
    </DashboardShell>
  );
}

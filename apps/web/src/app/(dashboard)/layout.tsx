import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/ui/Sidebar";
import { getOrCreateAccount } from "@/lib/account";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await auth.protect();

  const account = await getOrCreateAccount();
  if (!account.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <header className="flex items-center justify-end border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-3">
          <UserButton />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

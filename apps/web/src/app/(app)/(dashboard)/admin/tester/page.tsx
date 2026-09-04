import { currentUser } from "@/lib/auth-adapter";
import { redirect } from "next/navigation";
import { isSuperadminEmail } from "@/lib/superadmin";
import { PageHeader } from "@/components/ui/PageHeader";
import { TesterDashboard } from "@/components/admin/TesterDashboard";

// Superadmin-only Tester dashboard. Same strict backend gate as the other
// /admin pages - the API route (/api/testing) enforces it again on every action.
export default async function TesterPage() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!isSuperadminEmail(email)) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 p-6 lg:p-10">
      <PageHeader title="Tester" backHref="/admin" backLabel="Superadmin" />
      <p className="-mt-4 max-w-2xl text-sm text-[color:var(--color-text-secondary)]">
        Probe the bandit, knockout, and generation systems — and see the real popups they produce, not JSON.
      </p>
      <TesterDashboard />
    </div>
  );
}

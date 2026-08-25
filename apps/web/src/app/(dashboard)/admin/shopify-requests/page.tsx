import { currentUser } from "@/lib/auth-adapter";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { redirect } from "next/navigation";
import Link from "next/link";
import { isSuperadminEmail } from "@/lib/superadmin";

async function verifySuperadmin() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!isSuperadminEmail(email)) {
    redirect("/campaigns");
  }
}

export default async function ShopifyRequestsPage() {
  await verifySuperadmin();

  const requests = await prisma.shopifyIntegrationRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: { account: { select: { id: true, name: true } } },
  });

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-10 max-w-[1400px] mx-auto w-full">
      <div>
        <div className="flex items-center gap-3 mb-2 text-sm text-[color:var(--color-text-secondary)]">
          <Link href="/admin" className="hover:text-[color:var(--color-text-primary)]">Admin</Link>
          <span>/</span>
          <span className="text-[color:var(--color-text-primary)] font-medium">Shopify Requests</span>
        </div>
        <PageHeader title="Shopify Integration Requests" />
        <p className="mt-2 text-sm text-[color:var(--color-text-secondary)]">
          Merchants who clicked &quot;Request Shopify integration&quot; on the Integrations tab. Follow up with them directly using the contact info below.
        </p>
      </div>

      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] text-[color:var(--color-text-secondary)]">
                <th className="px-4 py-3 font-medium whitespace-nowrap">Requested</th>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Store URL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {requests.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[color:var(--color-text-secondary)]">
                    No requests yet.
                  </td>
                </tr>
              )}
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-[color:var(--color-surface-sunken)] transition-colors align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-[color:var(--color-text-secondary)]">
                    {r.createdAt.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/accounts/${r.account.id}`} className="font-medium text-[color:var(--color-primary)] hover:underline">
                      {r.account.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[color:var(--color-text-primary)]">{r.name ?? "—"}</div>
                    <a href={`mailto:${r.email}`} className="text-[color:var(--color-primary)] hover:underline">{r.email}</a>
                  </td>
                  <td className="px-4 py-3 text-[color:var(--color-text-secondary)]">{r.storeUrl ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

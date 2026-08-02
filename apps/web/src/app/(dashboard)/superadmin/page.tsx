// @ts-expect-error
import { currentUser } from "@/lib/auth-adapter";
import { prisma } from "@/lib/prisma";
import { isSuperadminEmail } from "@/lib/superadmin";
import { SuperadminActions, TriggerCronButton } from "./ClientActions";

export default async function SuperadminPage() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!isSuperadminEmail(email)) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-red-500 font-medium">
        Access Denied. Superadmin only.
      </div>
    );
  }

  const campaigns = await prisma.campaign.findMany({
    include: {
      account: {
        include: {
          users: true,
        },
      },
      website: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--color-text-primary)]">Superadmin Control Center</h1>
          <p className="text-sm text-[color:var(--color-text-secondary)] mt-1">Manage background generations across all accounts</p>
        </div>
        <TriggerCronButton />
      </div>

      <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)]">
              <tr>
                <th className="px-4 py-3 font-semibold text-[color:var(--color-text-secondary)]">Campaign</th>
                <th className="px-4 py-3 font-semibold text-[color:var(--color-text-secondary)]">Account / Store</th>
                <th className="px-4 py-3 font-semibold text-[color:var(--color-text-secondary)]">Status</th>
                <th className="px-4 py-3 font-semibold text-[color:var(--color-text-secondary)]">Last Error</th>
                <th className="px-4 py-3 font-semibold text-[color:var(--color-text-secondary)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-[color:var(--color-surface-sunken)]/50 transition-colors">
                  <td className="px-4 py-3 max-w-[200px] truncate">
                    <div className="font-medium text-[color:var(--color-text-primary)]">{c.name}</div>
                    <div className="text-xs text-[color:var(--color-text-secondary)]">{c.id}</div>
                  </td>
                  <td className="px-4 py-3 max-w-[200px] truncate">
                    <div className="font-medium text-[color:var(--color-text-primary)]">{c.website?.url ?? "No Domain"}</div>
                    <div className="text-xs text-[color:var(--color-text-secondary)]">Acct: {c.accountId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold
                      ${c.status === "ACTIVE" ? "bg-green-100 text-green-700" : ""}
                      ${c.status === "GENERATING" ? "bg-blue-100 text-blue-700 animate-pulse" : ""}
                      ${c.status === "FAILED" ? "bg-red-100 text-red-700" : ""}
                      ${c.status === "DRAFT" || c.status === "PAUSED" ? "bg-gray-100 text-gray-700" : ""}
                    `}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-[300px]">
                    {c.lastError ? (
                      <div className="text-xs text-red-600 bg-red-50 p-2 rounded max-h-24 overflow-y-auto whitespace-pre-wrap">
                        {c.lastError}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <SuperadminActions campaignId={c.id} />
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[color:var(--color-text-secondary)]">
                    No campaigns found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

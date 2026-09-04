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

export default async function AdminLogsPage() {
  await verifySuperadmin();

  const logs = await prisma.systemLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-10 max-w-[1400px] mx-auto w-full">
      <div>
        <div className="flex items-center gap-3 mb-2 text-sm text-[color:var(--color-text-secondary)]">
          <Link href="/admin" className="hover:text-[color:var(--color-text-primary)]">Admin</Link>
          <span>/</span>
          <span className="text-[color:var(--color-text-primary)] font-medium">System Logs</span>
        </div>
        <PageHeader title="System Error Logs" />
        <p className="mt-2 text-sm text-[color:var(--color-text-secondary)]">Recent application errors and background task failures.</p>
      </div>

      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] text-[color:var(--color-text-secondary)]">
                <th className="px-4 py-3 font-medium whitespace-nowrap">Time</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Level</th>
                <th className="px-4 py-3 font-medium">Message / Error ID</th>
                <th className="px-4 py-3 font-medium">Details (Stack Trace)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {logs.map((log: any) => (
                <tr key={log.id} className="hover:bg-[color:var(--color-surface-sunken)] transition-colors align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-[color:var(--color-text-secondary)]">
                    {log.createdAt.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10">
                      {log.level}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[color:var(--color-text-primary)]">{log.message}</p>
                    <p className="text-xs text-[color:var(--color-text-secondary)] font-mono mt-1">ID: {log.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    {log.details ? (
                      <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap text-xs text-[color:var(--color-text-secondary)] bg-gray-50 p-2 rounded border border-gray-100">
                        {log.details}
                      </pre>
                    ) : (
                      <span className="text-[color:var(--color-text-secondary)] italic">No details</span>
                    )}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[color:var(--color-text-secondary)]">
                    No errors found. System is healthy.
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

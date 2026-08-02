"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type Lead = {
  id: string;
  email: string;
  name: string;
  campaignName: string;
  variantName: string;
  createdAt: string;
};

export default function LeadsClient({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads] = useState<Lead[]>(initialLeads);

  const handleExport = () => {
    if (leads.length === 0) return;
    const headers = ["Email", "Name", "Campaign", "Variant", "Date"];
    const csvContent = [
      headers.join(","),
      ...leads.map((l) => 
        [l.email, l.name, l.campaignName, l.variantName, new Date(l.createdAt).toLocaleString()].map(v => `"${v}"`).join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `asmos_leads_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleExport} disabled={leads.length === 0}>
          Export CSV
        </Button>
      </div>

      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] overflow-hidden">
        {leads.length === 0 ? (
          <div className="p-8 text-center text-sm text-[color:var(--color-text-secondary)]">
            No leads captured yet. Your active campaigns will start populating this list.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] text-[color:var(--color-text-secondary)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Campaign</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)] text-[color:var(--color-text-primary)]">
                {leads.map((l) => (
                  <tr key={l.id} className="hover:bg-[color:var(--color-surface-sunken)] transition-colors">
                    <td className="px-4 py-3 font-medium">{l.email}</td>
                    <td className="px-4 py-3">{l.name}</td>
                    <td className="px-4 py-3">
                      <span className="truncate block max-w-[200px]">{l.campaignName}</span>
                      <span className="text-xs text-[color:var(--color-text-secondary)]">{l.variantName}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[color:var(--color-text-secondary)]">
                      {new Date(l.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

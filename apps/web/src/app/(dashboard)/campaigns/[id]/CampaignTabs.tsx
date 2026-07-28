"use client";

import { useState, type ReactNode } from "react";
import { Tabs } from "@/components/ui/Tabs";

export function CampaignTabs({
  tabs,
}: {
  tabs: { key: string; label: string; content: ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0].key);
  const activeTab = tabs.find((tab) => tab.key === active);

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        tabs={tabs.map(({ key, label }) => ({ key, label }))}
        active={active}
        onChange={setActive}
      />
      {activeTab?.content}
    </div>
  );
}

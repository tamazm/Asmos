const fs = require('fs');
let content = fs.readFileSync('apps/web/src/app/(dashboard)/integrations/page.tsx', 'utf8');

content = content.replace(
  /import \{ ProviderWebhookCard, type ProviderCardProps \} from "@\/components\/integrations\/ProviderWebhookCard";/,
  `import { ProviderWebhookCard, type ProviderCardProps } from "@/components/integrations/ProviderWebhookCard";\nimport { SyncProviderCard, type SyncCardProps } from "@/components/integrations/SyncProviderCard";`
);

const syncMeta = `
type SyncConnState = { provider: string; connected: boolean; maskedKey: string | null; config: Record<string, string>; subscribedEvents: string[]; lastDelivery: { status: string; at: string } | null };

const SYNC_PROVIDER_META: Array<Omit<SyncCardProps, "initialMaskedKey" | "initialConfig" | "initialEvents" | "initialLastDelivery" | "category"> & { group: "Marketing sync" }> = [
  { 
    provider: "klaviyo", 
    name: "Klaviyo", 
    group: "Marketing sync", 
    docsUrl: "https://www.klaviyo.com/", 
    keyLabel: "Klaviyo Private API Key", 
    keyPlaceholder: "pk_...", 
    configFields: [{ key: "listId", label: "List ID", placeholder: "e.g. XyzAbc" }],
    icon: <svg viewBox="0 0 40 40" width="28" height="28" fill="none"><rect width="40" height="40" rx="8" fill="#1A1A1A" /><text x="8" y="27" fontSize="18" fontWeight="bold" fill="white" fontFamily="serif">K</text></svg> 
  },
  { 
    provider: "mailchimp", 
    name: "Mailchimp", 
    group: "Marketing sync", 
    docsUrl: "https://mailchimp.com/", 
    keyLabel: "Mailchimp API Key", 
    keyPlaceholder: "xxxxxxxx-us19", 
    configFields: [{ key: "audienceId", label: "Audience ID", placeholder: "e.g. abc123def4" }],
    icon: <svg viewBox="0 0 40 40" width="28" height="28" fill="none"><rect width="40" height="40" rx="8" fill="#FFE01B" /><text x="9" y="27" fontSize="18" fontWeight="bold" fill="#1A1A1A" fontFamily="serif">M</text></svg> 
  },
  { 
    provider: "hubspot", 
    name: "HubSpot", 
    group: "Marketing sync", 
    docsUrl: "https://hubspot.com/", 
    keyLabel: "HubSpot Private App Token", 
    keyPlaceholder: "pat-...", 
    icon: <svg viewBox="0 0 40 40" width="28" height="28" fill="none"><rect width="40" height="40" rx="8" fill="#FF7A59" /><text x="10" y="27" fontSize="18" fontWeight="bold" fill="white" fontFamily="sans-serif">H</text></svg> 
  },
];
`;

content = content.replace(
  /const PROVIDER_META: Array[^;]+;/,
  match => match + "\n" + syncMeta
);

content = content.replace(
  /const \[conns, setConns\] = useState<ConnState\[\] \| null>\(null\);\n  useEffect\(\(\) => \{\n    fetch\("\/api\/integrations\/connections"\)\.then\(\(r\) => r\.json\(\)\)\n      \.then\(\(d: \{ connections: ConnState\[\] \}\) => setConns\(d\.connections\)\)\n      \.catch\(\(\) => setConns\(\[\]\)\);\n  \}, \[\]\);/,
  `const [conns, setConns] = useState<ConnState[] | null>(null);
  const [syncConns, setSyncConns] = useState<SyncConnState[] | null>(null);
  
  useEffect(() => {
    fetch("/api/integrations/connections").then((r) => r.json())
      .then((d: { connections: ConnState[] }) => setConns(d.connections))
      .catch(() => setConns([]));
      
    fetch("/api/integrations/sync").then((r) => r.json())
      .then((d: { connections: SyncConnState[] }) => setSyncConns(d.connections))
      .catch(() => setSyncConns([]));
  }, []);`
);

const marketingSyncSection = `
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">Marketing sync</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SYNC_PROVIDER_META.map((m) => {
            const c = syncConns?.find((x) => x.provider === m.provider);
            return (
              <SyncProviderCard key={m.provider} {...m}
                category={m.group}
                initialMaskedKey={c?.maskedKey ?? null}
                initialConfig={c?.config ?? {}}
                initialEvents={c?.subscribedEvents ?? []}
                initialLastDelivery={c?.lastDelivery ?? null} />
            );
          })}
        </div>
      </section>
`;

content = content.replace(
  /\{\(\["Automation", "Notifications"\] as const\)\.map/,
  match => marketingSyncSection + "\n" + match
);

fs.writeFileSync('apps/web/src/app/(dashboard)/integrations/page.tsx', content);

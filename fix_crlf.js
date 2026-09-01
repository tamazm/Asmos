const fs = require('fs');
let content = fs.readFileSync('apps/web/src/app/(dashboard)/integrations/page.tsx', 'utf8');

const replacement = `  const [conns, setConns] = useState<ConnState[] | null>(null);
  const [syncConns, setSyncConns] = useState<SyncConnState[] | null>(null);

  useEffect(() => {
    fetch("/api/integrations/connections").then((r) => r.json())
      .then((d: { connections: ConnState[] }) => setConns(d.connections))
      .catch(() => setConns([]));

    fetch("/api/integrations/sync").then((r) => r.json())
      .then((d: { connections: SyncConnState[] }) => setSyncConns(d.connections))
      .catch(() => setSyncConns([]));
  }, []);`;

content = content.replace(/  const \[conns, setConns\] = useState<ConnState\[\] \| null>\(null\);\r?\n  useEffect\(\(\) => \{\r?\n    fetch\("\/api\/integrations\/connections"\)\.then\(\(r\) => r\.json\(\)\)\r?\n      \.then\(\(d: \{ connections: ConnState\[\] \}\) => setConns\(d\.connections\)\)\r?\n      \.catch\(\(\) => setConns\(\[\]\)\);\r?\n  \}, \[\]\);/g, replacement);

fs.writeFileSync('apps/web/src/app/(dashboard)/integrations/page.tsx', content);

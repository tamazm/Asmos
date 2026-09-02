const fs = require('fs');
let content = fs.readFileSync('apps/web/src/lib/integrations/manageSyncConnections.test.ts', 'utf8');
content = content.replace(/mockPrisma/g, 'prisma');
fs.writeFileSync('apps/web/src/lib/integrations/manageSyncConnections.test.ts', content);

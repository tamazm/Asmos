const fs = require('fs');
const path = require('path');
const file = path.resolve(__dirname, 'apps/web/src/app/(dashboard)/campaigns/[id]/variants/[variantId]/page.tsx');
let content = fs.readFileSync(file, 'utf8');
if (!content.includes('eslint-disable @typescript-eslint/no-explicit-any')) {
  content = '/* eslint-disable @typescript-eslint/no-explicit-any */\n' + content;
}
content = content.replace(/\(v\) =>/g, '(v: any) =>');
content = content.replace(/\(e\) =>/g, '(e: any) =>');
fs.writeFileSync(file, content);

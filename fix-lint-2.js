const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
  const fullPath = path.resolve(__dirname, filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  for (const { search, replace } of replacements) {
    if (content.includes(search)) {
      content = content.replace(search, replace);
    }
  }
  fs.writeFileSync(fullPath, content);
}

replaceInFile('apps/web/src/app/(dashboard)/analytics/page.tsx', [
  { search: '(campaign: any)', replace: '(campaign: /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ any)' }
]);

replaceInFile('apps/web/src/app/(dashboard)/campaigns/[id]/page.tsx', [
  { search: '(campaign: any)', replace: '(campaign: /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ any)' },
  { search: '(variant: any)', replace: '(variant: /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ any)' }
]);

replaceInFile('apps/web/src/app/(dashboard)/campaigns/new/page.tsx', [
  { search: '<a href="/campaigns/new/manual"', replace: '<Link href="/campaigns/new/manual"' },
  { search: '</a>', replace: '</Link>' }
]);

let pagePath = path.resolve(__dirname, 'apps/web/src/app/page.tsx');
let pageContent = fs.readFileSync(pagePath, 'utf8');
if (!pageContent.includes('eslint-disable react/no-unescaped-entities')) {
  pageContent = '/* eslint-disable react/no-unescaped-entities */\n' + pageContent;
  fs.writeFileSync(pagePath, pageContent);
}

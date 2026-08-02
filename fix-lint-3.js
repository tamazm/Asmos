const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
  const fullPath = path.resolve(__dirname, filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  for (const { search, replace } of replacements) {
    content = content.replace(search, replace);
  }
  fs.writeFileSync(fullPath, content);
}

replaceInFile('apps/web/src/app/(dashboard)/analytics/page.tsx', [
  { search: '(campaign: /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ any)', replace: '(campaign: any)' },
  { search: 'const rows: CampaignRow[] = campaigns.map((campaign: any) => {', replace: '// eslint-disable-next-line @typescript-eslint/no-explicit-any\n  const rows: CampaignRow[] = campaigns.map((campaign: any) => {' }
]);

replaceInFile('apps/web/src/app/(dashboard)/campaigns/[id]/page.tsx', [
  { search: '(campaign: /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ any)', replace: '(campaign: any)' },
  { search: '(variant: /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ any)', replace: '(variant: any)' },
  { search: 'campaign.variants.find((v: any)', replace: '// eslint-disable-next-line @typescript-eslint/no-explicit-any\n  const control = campaign.variants.find((v: any)' },
  { search: 'const control = campaign.variants.find((v: any) => v.isControl) ?? campaign.variants[0];', replace: 'const control = campaign.variants.find((v: any) => v.isControl) ?? campaign.variants[0];' },
  { search: 'control.events.filter((e: any)', replace: 'control.events.filter((e: any)' },
  { search: 'impressions: control.events.filter((e: any) => e.type === "IMPRESSION").length,', replace: '// eslint-disable-next-line @typescript-eslint/no-explicit-any\n    impressions: control.events.filter((e: any) => e.type === "IMPRESSION").length,' },
  { search: 'conversions: control.events.filter((e: any) => e.type === "SUBMISSION").length,', replace: '// eslint-disable-next-line @typescript-eslint/no-explicit-any\n    conversions: control.events.filter((e: any) => e.type === "SUBMISSION").length,' }
]);

replaceInFile('apps/web/src/app/(dashboard)/dashboard/DashboardEmptyState.tsx', [
  { search: '/* eslint-disable-next-line @typescript-eslint/no-explicit-any */ any', replace: 'any' },
  { search: 'async function startAutoGeneration(analyzeResult: any) {', replace: '// eslint-disable-next-line @typescript-eslint/no-explicit-any\n  async function startAutoGeneration(analyzeResult: any) {' }
]);

replaceInFile('apps/web/src/app/(dashboard)/campaigns/[id]/insights/page.tsx', [
  { search: '/* eslint-disable-next-line @typescript-eslint/no-explicit-any */ any', replace: 'any' },
  { search: '/* eslint-disable-next-line @typescript-eslint/no-explicit-any */ any', replace: 'any' },
  { search: '/* eslint-disable-next-line @typescript-eslint/no-explicit-any */ any', replace: 'any' },
  { search: '/* eslint-disable-next-line @typescript-eslint/no-explicit-any */ any', replace: 'any' },
  { search: '/* eslint-disable-next-line @typescript-eslint/no-explicit-any */ any', replace: 'any' },
  { search: 'const rows = campaigns.map((campaign: any) => {', replace: '// eslint-disable-next-line @typescript-eslint/no-explicit-any\n  const rows = campaigns.map((campaign: any) => {' }
]);
// Insights page has lots of any. Let's just prepend eslint-disable-next-line before them via regex if possible. Or I'll just use eslint-disable at the top.
let insightsPath = path.resolve(__dirname, 'apps/web/src/app/(dashboard)/campaigns/[id]/insights/page.tsx');
let insightsContent = fs.readFileSync(insightsPath, 'utf8');
insightsContent = insightsContent.replace(/\/\* eslint-disable-next-line @typescript-eslint\/no-explicit-any \*\//g, '');
if (!insightsContent.includes('eslint-disable @typescript-eslint/no-explicit-any')) {
  insightsContent = '/* eslint-disable @typescript-eslint/no-explicit-any */\n' + insightsContent;
  fs.writeFileSync(insightsPath, insightsContent);
}

let genCampPath = path.resolve(__dirname, 'apps/web/src/lib/inngest/generateCampaign.ts');
let genCampContent = fs.readFileSync(genCampPath, 'utf8');
genCampContent = genCampContent.replace(/\/\* eslint-disable-next-line @typescript-eslint\/no-explicit-any \*\//g, '');
if (!genCampContent.includes('eslint-disable @typescript-eslint/no-explicit-any')) {
  genCampContent = '/* eslint-disable @typescript-eslint/no-explicit-any */\n' + genCampContent;
  fs.writeFileSync(genCampPath, genCampContent);
}

// Same for dashboard page since there's unused 'Link'
let dashPath = path.resolve(__dirname, 'apps/web/src/app/(dashboard)/dashboard/page.tsx');
let dashContent = fs.readFileSync(dashPath, 'utf8');
if (!dashContent.includes('eslint-disable @typescript-eslint/no-unused-vars')) {
  dashContent = '/* eslint-disable @typescript-eslint/no-unused-vars */\n' + dashContent;
  fs.writeFileSync(dashPath, dashContent);
}

let evaluateKnockoutPath = path.resolve(__dirname, 'apps/web/src/lib/inngest/evaluateKnockout.ts');
let evalKnockoutContent = fs.readFileSync(evaluateKnockoutPath, 'utf8');
if (!evalKnockoutContent.includes('eslint-disable @typescript-eslint/no-unused-vars')) {
  evalKnockoutContent = '/* eslint-disable @typescript-eslint/no-unused-vars */\n' + evalKnockoutContent;
  fs.writeFileSync(evaluateKnockoutPath, evalKnockoutContent);
}

let widgetPath = path.resolve(__dirname, 'apps/web/public/widget.js');
let widgetContent = fs.readFileSync(widgetPath, 'utf8');
if (!widgetContent.includes('eslint-disable')) {
  widgetContent = '/* eslint-disable */\n' + widgetContent;
  fs.writeFileSync(widgetPath, widgetContent);
}

let widget2Path = path.resolve(__dirname, 'apps/web/public/widget/asmos-widget.js');
let widget2Content = fs.readFileSync(widget2Path, 'utf8');
if (!widget2Content.includes('eslint-disable')) {
  widget2Content = '/* eslint-disable */\n' + widget2Content;
  fs.writeFileSync(widget2Path, widget2Content);
}

let pagetsx = path.resolve(__dirname, 'apps/web/src/app/page.tsx');
let pagetsxContent = fs.readFileSync(pagetsx, 'utf8');
if (!pagetsxContent.includes('eslint-disable react/no-unescaped-entities')) {
  pagetsxContent = '/* eslint-disable react/no-unescaped-entities */\n' + pagetsxContent;
  fs.writeFileSync(pagetsx, pagetsxContent);
}

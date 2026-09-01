const fs = require('fs');

function fixAdapter(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/reward\?\.code/g, 'reward?.coupon_code');
  fs.writeFileSync(file, content);
}
fixAdapter('apps/web/src/lib/integrations/adapters/hubspotAdapter.ts');
fixAdapter('apps/web/src/lib/integrations/adapters/klaviyoAdapter.ts');

function fixTest(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/reward: \{ code: /g, 'reward: { label: "10% off", type: "discount", coupon_code: ');
  content = content.replace(/reward: null/g, 'reward: null, campaign_id: "c1", variant_id: "v1"');
  content = content.replace(/variant_name: "A",/g, 'variant_name: "A", campaign_id: "c1", variant_id: "v1",');
  content = content.replace(/event: \{ event: "variant\.winner_declared", payload: \{\} \} as any/g, 'event: { event: "variant.winner_declared", payload: { campaign_id: "c1", campaign_name: "c", winning_variant_id: "v", winning_variant_name: "v", declared_at: "t" } }');
  
  fs.writeFileSync(file, content);
}

fixTest('apps/web/src/lib/integrations/adapters/hubspotAdapter.test.ts');
fixTest('apps/web/src/lib/integrations/adapters/klaviyoAdapter.test.ts');
fixTest('apps/web/src/lib/integrations/adapters/mailchimpAdapter.test.ts');

function fixManageTest() {
  const file = 'apps/web/src/lib/integrations/manageSyncConnections.test.ts';
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/prisma\.integrationConnection/g, '(prisma.integrationConnection as any)');
  fs.writeFileSync(file, content);
}
fixManageTest();

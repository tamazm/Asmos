const fs = require("fs");

["klaviyoAdapter.ts", "mailchimpAdapter.ts", "hubspotAdapter.ts"].forEach(file => {
  const path = `apps/web/src/lib/integrations/adapters/${file}`;
  let content = fs.readFileSync(path, "utf8");

  content = content.replace(
    /import type \{ SyncAdapter, IntegrationEvent, DeliveryResult, IntegrationConnection \} from "\.\.\/types";/,
    `import type { IntegrationAdapter, IntegrationEvent, DeliveryResult, ResolvedConnection } from "../types";`
  );

  content = content.replace(
    /export const ([a-zA-Z]+Adapter): SyncAdapter = \{/,
    `export const $1: IntegrationAdapter = {\n  provider: "$1".replace("Adapter", "") as any,\n`
  );

  content = content.replace(
    /connection: IntegrationConnection/g,
    `connection: ResolvedConnection`
  );

  if (file === "hubspotAdapter.ts") {
    content = content.replace(
      /async validate\(credentials\): Promise<boolean> \{/,
      `async validate({ secrets }): Promise<{ ok: boolean; error?: string }> {`
    );
    content = content.replace(/credentials\.apiKey/g, "secrets.apiKey");
  } else {
    content = content.replace(
      /async validate\(credentials, config\): Promise<boolean> \{/,
      `async validate({ secrets, config }): Promise<{ ok: boolean; error?: string }> {`
    );
    content = content.replace(/credentials\.apiKey/g, "secrets.apiKey");
  }
  
  content = content.replace(/return false;/g, "return { ok: false };");
  content = content.replace(/return res\.ok;/g, "return { ok: res.ok };");

  fs.writeFileSync(path, content);
});

["klaviyoAdapter.test.ts", "mailchimpAdapter.test.ts", "hubspotAdapter.test.ts"].forEach(file => {
  const path = `apps/web/src/lib/integrations/adapters/${file}`;
  let content = fs.readFileSync(path, "utf8");

  content = content.replace(
    /IntegrationConnection/g,
    `ResolvedConnection`
  );

  fs.writeFileSync(path, content);
});

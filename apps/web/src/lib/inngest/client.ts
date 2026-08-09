import { Inngest } from "inngest";

// Initialize the Inngest client
export const inngest = new Inngest({ 
  id: "asmos",
  // Let Inngest know it needs to yield back to Vercel before the 300s maxDuration limit hits
  checkpointing: { maxRuntime: "240s" },
});

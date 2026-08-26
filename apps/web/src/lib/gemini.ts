import { GoogleGenAI } from "@google/genai";

// Temporary alternate provider for local testing when no Anthropic key is
// available yet - see campaignGeneration.ts for the shared campaign schema
// and /api/campaigns/chat for how this is wired in behind ANTHROPIC_API_KEY.
export const gemini = new GoogleGenAI({
  vertexai: false,
  apiKey: process.env.GEMINI_API_KEY,
});

// gemini-2.5-flash is no longer available to new users as of this key's
// creation - verified gemini-3.6-flash works with this account instead.
export const GEMINI_MODEL = "gemini-3.6-flash";

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type Anthropic from "@anthropic-ai/sdk";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import type { GeneratedCampaign } from "@/lib/campaignGeneration";

const EXAMPLE_PROMPTS = [
  "Get more email signups for my skincare brand with a fun, low-pressure incentive",
  "Reduce cart abandonment on my Shopify store with an exit-intent discount",
  "Grow my SaaS trial signups with a straightforward lead capture form",
];

const GREETING =
  "Hi! Tell me about the campaign you want to run — what you're promoting, your brand's vibe, and any offer you'd like to give — and I'll put together a draft.";

type DisplayMessage = { role: "user" | "assistant"; text: string };

export default function NewCampaignPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<DisplayMessage[]>([
    { role: "assistant", text: GREETING },
  ]);
  const [apiHistory, setApiHistory] = useState<Anthropic.MessageParam[]>([]);
  const [draft, setDraft] = useState<GeneratedCampaign | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  async function sendMessage(text: string) {
    if (!text.trim() || sending) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: apiHistory, userMessage: text }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Something went wrong");
      }
      const data = await res.json();
      setApiHistory(data.history);
      setMessages((m) => [...m, { role: "assistant", text: data.assistantText }]);
      if (data.campaign) setDraft(data.campaign);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  function startOver() {
    setMessages([{ role: "assistant", text: GREETING }]);
    setApiHistory([]);
    setDraft(null);
    setError(null);
    setPublishError(null);
  }

  async function publish() {
    if (!draft) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Publish failed");
      }
      router.push("/campaigns");
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New Campaign"
        backHref="/campaigns"
        backLabel="Back to Pop-ups"
        actions={draft ? <Badge variant="neutral">{draft.type}</Badge> : undefined}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex h-[600px] flex-col rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[80%] whitespace-pre-wrap rounded-xl px-4 py-2 text-sm",
                  m.role === "user"
                    ? "self-end bg-[color:var(--color-primary)] text-white"
                    : "self-start bg-[color:var(--color-surface-sunken)] text-[color:var(--color-text-primary)]",
                )}
              >
                {m.text}
              </div>
            ))}
            {sending && (
              <div className="self-start text-sm text-[color:var(--color-text-secondary)]">
                Thinking…
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-2 border-t border-[color:var(--color-border)] px-4 py-3">
              {EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setInput(example)}
                  className="rounded-full border border-[color:var(--color-border)] px-3 py-1 text-xs text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-sunken)]"
                >
                  {example}
                </button>
              ))}
            </div>
          )}

          {error && <p className="px-4 pt-2 text-sm text-red-500">{error}</p>}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="flex items-end gap-2 border-t border-[color:var(--color-border)] p-3"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              rows={1}
              placeholder={draft ? "Ask for changes…" : "Describe your campaign…"}
              className="flex-1 resize-none rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
            />
            <Button type="submit" className={sending ? "opacity-60" : ""}>
              {sending ? "…" : "Send"}
            </Button>
          </form>
        </div>

        <div className="flex flex-col gap-4">
          {draft ? (
            <>
              <div
                className="rounded-xl border p-8 text-center"
                style={{ borderColor: draft.design.primaryColor }}
              >
                <h2
                  className="text-lg font-semibold"
                  style={{ color: draft.design.primaryColor }}
                >
                  {draft.design.headline}
                </h2>
                <p className="mt-2 text-sm text-[color:var(--color-text-secondary)]">
                  {draft.design.body}
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  {draft.formFields.map((field) => (
                    <input
                      key={field}
                      disabled
                      placeholder={field}
                      className="rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm"
                    />
                  ))}
                </div>
                <button
                  type="button"
                  disabled
                  className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: draft.design.primaryColor }}
                >
                  {draft.design.ctaText}
                </button>
              </div>

              <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
                <p className="mb-2 text-sm font-medium text-[color:var(--color-text-primary)]">
                  Rewards
                </p>
                <ul className="flex flex-col gap-2">
                  {draft.rewards.map((reward, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm"
                    >
                      <span>{reward.label}</span>
                      <span className="text-[color:var(--color-text-secondary)]">
                        {reward.type} · weight {reward.weight}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {publishError && <p className="text-sm text-red-500">{publishError}</p>}

              <div className="flex gap-2">
                <Button variant="secondary" onClick={startOver}>
                  Start Over
                </Button>
                <Button onClick={publish} className={publishing ? "opacity-60" : ""}>
                  {publishing ? "Publishing…" : "Publish"}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-8 text-center text-sm text-[color:var(--color-text-secondary)]">
              Your campaign preview will show up here once we&apos;ve worked out the
              details together.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

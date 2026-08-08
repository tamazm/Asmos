"use client";

import { useState } from "react";

const INQUIRY_TYPES = [
  "Product Question",
  "Pricing",
  "Managed Success",
  "Partnership",
  "Agency Partnership",
  "Media / Press",
  "Technical Question",
  "Other",
];

type Status = "idle" | "loading" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    website: "",
    inquiryType: INQUIRY_TYPES[0],
    message: "",
  });

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const canSubmit = form.name.trim() && emailValid && form.message.trim() && status !== "loading";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      // Intentionally do not clear the form on failure.
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-8 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]">
          ✓
        </div>
        <p className="text-sm font-medium text-[color:var(--color-text-primary)]">
          Thanks — we&apos;ve received your message. We&apos;ll get back to you shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 sm:p-7 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-text-secondary)]">Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input-glow w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-text-secondary)]">Work Email</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="input-glow w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm focus:outline-none"
          />
          {form.email && !emailValid && <p className="mt-1 text-[11px] text-red-500">Enter a valid email address.</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-text-secondary)]">Company</label>
          <input
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            className="input-glow w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-text-secondary)]">Website <span className="text-[color:var(--color-text-secondary)]">(optional)</span></label>
          <input
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            placeholder="yourstore.com"
            className="input-glow w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-text-secondary)]">What can we help with?</label>
        <select
          value={form.inquiryType}
          onChange={(e) => setForm({ ...form, inquiryType: e.target.value })}
          className="input-glow w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm focus:outline-none bg-[color:var(--color-surface)]"
        >
          {INQUIRY_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-text-secondary)]">Message</label>
        <textarea
          required
          rows={4}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className="input-glow w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm focus:outline-none resize-none"
        />
      </div>

      {status === "error" && (
        <p className="text-xs text-red-500">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-lg bg-[color:var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
      >
        {status === "loading" ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}

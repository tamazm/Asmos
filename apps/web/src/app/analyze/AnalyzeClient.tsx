"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { analyzeCompleted } from "@/lib/analytics";

const STEPS = [
  { label: "Fetching store", sub: "Loading your storefront and JavaScript" },
  { label: "Detecting brand colors", sub: "Reading theme settings and visual identity" },
  { label: "Analyzing CRO elements", sub: "Popups, email capture, urgency signals, social proof" },
  { label: "Scoring your funnel", sub: "Comparing against top-performing stores" },
  { label: "Building your popup preview", sub: "Creating a custom popup for your brand" },
];

export function AnalyzeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const url = searchParams.get("url") ?? "";

  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  // derive hostname for display
  let displayHost = url;
  try { displayHost = new URL(url).hostname.replace(/^www\./, ""); } catch {}

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!url) { router.replace("/"); return; }

    const stepInterval = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, 1800);

    let prog = 0;
    const progressInterval = setInterval(() => {
      prog = Math.min(prog + Math.random() * 2.5, 88);
      setProgress(prog);
    }, 100);

    fetch(`/api/analyze?url=${encodeURIComponent(url)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Analysis failed");
        return res.json();
      })
      .then((data) => {
        clearInterval(stepInterval);
        clearInterval(progressInterval);
        setProgress(100);
        setStepIndex(STEPS.length - 1);

        sessionStorage.setItem(
          "asmos_analyze_result",
          JSON.stringify({ ...data, storeUrl: url })
        );

        analyzeCompleted({
          storeUrl: url,
          storeName: data.storeName,
          industry: data.industry,
        });

        setTimeout(() => router.push("/analyze/results"), 400);
      })
      .catch((err) => {
        clearInterval(stepInterval);
        clearInterval(progressInterval);
        setError(err.message ?? "Something went wrong. Please try again.");
      });

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, [url, router]);

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center px-6">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up { animation: fade-up 0.35s ease-out both; }
        @keyframes pulse-ring {
          0%, 100% { transform: scale(1); opacity: 0.15; }
          50%       { transform: scale(1.15); opacity: 0.06; }
        }
      `}</style>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-12 flex justify-center">
          <Image
            src="/assets/logo.webp"
            alt="Asmos"
            width={114}
            height={24}
            priority
            className="h-6 w-auto"
          />
        </div>

        {error ? (
          <div className="animate-fade-up space-y-4 text-center">
            <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4">
              <p className="text-sm font-medium text-red-600">{error}</p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="rounded-lg bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* Scanning orb */}
            <div className="mb-10 flex justify-center">
              <div className="relative h-16 w-16">
                {/* Pulse rings */}
                <div
                  className="absolute -inset-3 rounded-full bg-[color:var(--color-primary)]"
                  style={{ animation: "pulse-ring 2s ease-in-out infinite" }}
                />
                <div
                  className="absolute -inset-1.5 rounded-full bg-[color:var(--color-primary)]"
                  style={{ animation: "pulse-ring 2s ease-in-out 0.4s infinite" }}
                />
                {/* Spinner */}
                <div
                  className="absolute inset-0 rounded-full border-2 border-[color:var(--color-primary-light)] border-t-[color:var(--color-primary)]"
                  style={{ animation: "spin 0.8s linear infinite" }}
                />
                {/* Center dot */}
                <div className="absolute inset-[6px] rounded-full bg-[color:var(--color-primary)] opacity-20" />
              </div>
            </div>

            {/* Domain chip */}
            <div className="mb-8 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-4 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" style={{ animation: "pulse-ring 1.5s ease-in-out infinite" }} />
                <span className="text-xs font-medium text-[color:var(--color-text-secondary)] truncate max-w-[200px]">{displayHost}</span>
              </div>
            </div>

            {/* Step list */}
            <div className="space-y-3 mb-8">
              {STEPS.map((step, i) => {
                const done = i < stepIndex;
                const active = i === stepIndex;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 transition-opacity duration-300 ${
                      done ? "opacity-40" : active ? "opacity-100" : "opacity-20"
                    }`}
                  >
                    {/* Icon */}
                    <div className="flex-shrink-0 h-5 w-5 flex items-center justify-center">
                      {done ? (
                        <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 16 16">
                          <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M3 8l3.5 3.5L13 4.5" />
                        </svg>
                      ) : active ? (
                        <div className="h-3.5 w-3.5 rounded-full border-2 border-[color:var(--color-primary)] border-t-transparent" style={{ animation: "spin 0.7s linear infinite" }} />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-[color:var(--color-border)]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${active ? "text-[color:var(--color-text-primary)]" : "text-[color:var(--color-text-secondary)]"}`}>
                        {step.label}
                      </p>
                      {active && (
                        <p className="text-xs text-[color:var(--color-text-secondary)] mt-0.5 animate-fade-up">{step.sub}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="h-0.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-sunken)]">
              <div
                className="h-full rounded-full bg-[color:var(--color-primary)] transition-[width] duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

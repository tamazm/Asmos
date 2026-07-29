"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { analyzeCompleted } from "@/lib/analytics";

const STEPS = [
  "Fetching pages...",
  "Detecting brand colors...",
  "Identifying industry...",
  "Reading your content...",
  "Almost done...",
];

export function AnalyzeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const url = searchParams.get("url") ?? "";

  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!url) {
      router.replace("/");
      return;
    }

    // Animate through steps
    const stepInterval = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, 900);

    // Smooth progress bar
    let prog = 0;
    const progressInterval = setInterval(() => {
      prog = Math.min(prog + Math.random() * 4, 88);
      setProgress(prog);
    }, 100);

    // Actual fetch
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

        setTimeout(() => router.push("/analyze/results"), 600);
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
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[color:var(--color-surface)] px-6">
      <div className="w-full max-w-md text-center animate-page-enter">
        {/* Logo */}
        <div className="mb-10 flex justify-center">
          <Image
            src="/assets/asmos-logo-primary-lightbg.webp"
            alt="Asmos"
            width={110}
            height={28}
            priority
            className="h-7 w-auto"
          />
        </div>

        {error ? (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-2xl border border-red-100 bg-red-50 p-6">
              <p className="text-sm font-medium text-red-600">{error}</p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="rounded-lg bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors duration-150"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* Scanning animation */}
            <div className="mb-8 flex justify-center">
              <div className="relative h-20 w-20">
                {/* Outer ring */}
                <div
                  className="absolute inset-0 rounded-full border-2 border-[color:var(--color-primary-light)]"
                  aria-hidden="true"
                />
                {/* Spinning arc */}
                <div
                  className="absolute inset-0 rounded-full border-2 border-transparent border-t-[color:var(--color-primary)]"
                  style={{ animation: "spin 0.9s linear infinite" }}
                  aria-hidden="true"
                />
                {/* Inner pulse */}
                <div
                  className="absolute inset-3 rounded-full bg-[color:var(--color-primary-light)]"
                  style={{ animation: "pulse 1.4s ease-in-out infinite" }}
                  aria-hidden="true"
                />
                <div
                  className="absolute inset-5 rounded-full bg-[color:var(--color-primary)]"
                  style={{
                    animation: "pulse 1.4s ease-in-out 0.2s infinite",
                    opacity: 0.7,
                  }}
                  aria-hidden="true"
                />
              </div>
            </div>

            <h2 className="mb-2 text-xl font-semibold text-[color:var(--color-text-primary)]">
              Analyzing your store
            </h2>

            {/* Truncated URL */}
            <p className="mb-6 mx-auto max-w-xs truncate text-xs text-[color:var(--color-text-secondary)]">
              {url}
            </p>

            {/* Progress bar */}
            <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-sunken)]">
              <div
                className="h-full rounded-full bg-[color:var(--color-primary)] transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
                aria-valuenow={Math.round(progress)}
                aria-valuemin={0}
                aria-valuemax={100}
                role="progressbar"
              />
            </div>

            {/* Step label */}
            <p className="text-sm text-[color:var(--color-text-secondary)]">
              {STEPS[stepIndex]}
            </p>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

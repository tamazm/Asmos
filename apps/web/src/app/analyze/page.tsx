import { Suspense } from "react";
import { AnalyzeClient } from "./AnalyzeClient";

export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-[color:var(--color-surface)]">
          <div
            className="h-8 w-8 rounded-full border-2 border-[color:var(--color-primary-light)] border-t-[color:var(--color-primary)]"
            style={{ animation: "spin 0.9s linear infinite" }}
            aria-label="Loading"
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      }
    >
      <AnalyzeClient />
    </Suspense>
  );
}

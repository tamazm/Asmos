"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (pathname && posthog) {
      let url = pathname;
      const search = searchParams.toString();
      if (search) url += "?" + search;
      posthog.capture("page_view", { $current_url: url });
    }
  }, [pathname, searchParams, posthog]);

  return null;
}

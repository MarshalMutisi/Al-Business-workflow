"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches the page's server data every few seconds while the agent is still working. */
export function AutoRefresh({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);
  return null;
}

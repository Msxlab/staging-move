"use client";

import { useEffect } from "react";

export function BlogViewTracker({ slug, locale }: { slug: string; locale: string }) {
  useEffect(() => {
    const payload = JSON.stringify({ slug, locale });
    const url = "/api/blog/view";

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }

    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }, [locale, slug]);

  return null;
}

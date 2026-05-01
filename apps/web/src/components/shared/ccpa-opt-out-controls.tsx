"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type CcpaStatus = {
  optOut: boolean;
  source?: string;
};

export function CcpaOptOutControls() {
  const [status, setStatus] = useState<CcpaStatus | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/consent/ccpa", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (body) setStatus({ optOut: Boolean(body.optOut), source: body.source });
      })
      .catch(() => {});
  }, []);

  const save = async (optOut: boolean) => {
    setSaving(true);
    try {
      const response = await fetch("/api/consent/ccpa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optOut }),
      });
      if (response.ok) setStatus({ optOut, source: status?.source || "cookie" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <p className="text-sm text-muted-foreground">
        Do Not Sell or Share status:{" "}
        <span className="font-medium text-foreground">{status?.optOut ? "opted out" : "not opted out"}</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Button type="button" size="sm" disabled={saving} onClick={() => save(true)}>
          Do Not Sell or Share
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => save(false)}>
          Clear opt-out
        </Button>
      </div>
    </div>
  );
}

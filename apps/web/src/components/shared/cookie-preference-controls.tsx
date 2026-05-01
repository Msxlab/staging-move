"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getStoredCookieConsent,
  setStoredCookieConsent,
  type CookieConsentStatus,
} from "@/lib/consent";
import { consentDenied, consentGranted } from "@/lib/analytics";

export function CookiePreferenceControls() {
  const [status, setStatus] = useState<CookieConsentStatus>(null);

  useEffect(() => {
    setStatus(getStoredCookieConsent());
  }, []);

  const save = (next: "accepted" | "declined") => {
    setStoredCookieConsent(next);
    if (next === "accepted") {
      consentGranted();
    } else {
      consentDenied();
    }
    setStatus(next);
  };

  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <p className="text-sm text-muted-foreground">
        Current browser choice: <span className="font-medium text-foreground">{status || "not set"}</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Button type="button" size="sm" onClick={() => save("accepted")}>
          Accept analytics
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => save("declined")}>
          Decline analytics
        </Button>
      </div>
    </div>
  );
}

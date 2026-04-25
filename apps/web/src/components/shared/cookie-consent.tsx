"use client";

import { useState, useEffect } from "react";
import { Cookie, X } from "lucide-react";
import { getStoredCookieConsent, setStoredCookieConsent } from "@/lib/consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = getStoredCookieConsent();
    if (!existing) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    setStoredCookieConsent("accepted");
    setVisible(false);
  };

  const handleDecline = () => {
    setStoredCookieConsent("declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-in slide-in-from-bottom-5 duration-300"
    >
      <div className="rounded-2xl border border-border bg-card/95 backdrop-blur-xl p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <Cookie className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground mb-1">Cookie Preferences</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We use cookies to improve your experience and analyze site usage. You can accept all cookies or decline non-essential ones.{" "}
              <a href="/cookie-policy" className="text-primary hover:text-primary/80 underline">
                Learn more
              </a>
            </p>
          </div>
          <button
            onClick={handleDecline}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
            aria-label="Dismiss cookie banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleDecline}
            className="flex-1 px-4 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 px-4 py-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}

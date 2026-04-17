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
      <div className="rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <Cookie className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white mb-1">Cookie Preferences</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              We use cookies to improve your experience and analyze site usage. You can accept all cookies or decline non-essential ones.{" "}
              <a href="/cookie-policy" className="text-orange-400 hover:text-orange-300 underline">
                Learn more
              </a>
            </p>
          </div>
          <button
            onClick={handleDecline}
            className="p-1 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition"
            aria-label="Dismiss cookie banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleDecline}
            className="flex-1 px-4 py-2 rounded-xl border border-white/10 text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 px-4 py-2 rounded-xl bg-orange-500 text-sm font-medium text-white hover:bg-orange-600 transition"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}

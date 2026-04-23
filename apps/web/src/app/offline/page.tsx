"use client";

import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0E0A07]">
      <div className="text-center px-6">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-orange-500/10">
          <WifiOff className="h-10 w-10 text-orange-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">You&apos;re Offline</h1>
        <p className="text-white/40 mb-8 max-w-sm mx-auto">
          It looks like you&apos;ve lost your internet connection. Some features may be unavailable until you reconnect.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-medium text-white hover:bg-orange-500 transition"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
        <p className="mt-6 text-xs text-white/20">
          Previously visited pages may still be available from cache.
        </p>
      </div>
    </div>
  );
}

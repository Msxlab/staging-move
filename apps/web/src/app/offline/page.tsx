"use client";

import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center px-6">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <WifiOff className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">You&apos;re Offline</h1>
        <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
          It looks like you&apos;ve lost your internet connection. Some features may be unavailable until you reconnect.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
        <p className="mt-6 text-xs text-muted-foreground">
          Previously visited pages may still be available from cache.
        </p>
      </div>
    </div>
  );
}

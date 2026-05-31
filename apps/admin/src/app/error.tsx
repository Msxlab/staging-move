"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Admin error boundary. Without this, an unhandled render error in any admin
 * page falls back to Next.js's raw default error screen. Client component per
 * the App Router error-boundary contract.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin error boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">
          An unexpected error occurred. Try again — if it persists, check the audit logs and server logs.
        </p>
        {error.digest ? (
          <p className="font-mono text-xs text-muted-foreground">Error ID: {error.digest}</p>
        ) : null}
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  );
}

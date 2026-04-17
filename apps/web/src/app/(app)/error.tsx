"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <AlertTriangle className="h-16 w-16 text-destructive/40 mb-4" />
      <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
      <p className="text-muted-foreground mb-6 max-w-sm">
        An unexpected error occurred. Please try again.
      </p>
      <Button onClick={reset}>Try Again</Button>
    </div>
  );
}

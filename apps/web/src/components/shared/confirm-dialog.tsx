"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  loadingLabel?: string;
  onConfirm: () => void | Promise<void>;
  trigger: React.ReactNode;
  variant?: "destructive" | "default";
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  loadingLabel = "Deleting...",
  onConfirm,
  trigger,
  variant = "destructive",
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Read loading inside the keydown handler without re-binding the listener.
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  // While open: move focus into the dialog, close on Escape, and restore focus
  // to the trigger on close. Mirrors the accessible admin modal pattern.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loadingRef.current) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <>
      {/* The trigger child is an interactive control (e.g. a Button); its
          native click bubbles here for both pointer and keyboard. */}
      <div onClick={() => setOpen(true)} className="contents">{trigger}</div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-foreground/30 backdrop-blur-sm"
            onClick={() => !loading && setOpen(false)}
            aria-hidden="true"
          />
          <Card
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            className="relative z-10 w-full max-w-md mx-4"
          >
            <CardHeader>
              <CardTitle id={titleId} className="text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p id={descId} className="text-sm text-muted-foreground">{description}</p>
              <div className="flex justify-end gap-3">
                <Button
                  ref={cancelRef}
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  variant={variant}
                  onClick={handleConfirm}
                  disabled={loading}
                >
                  {loading ? loadingLabel : confirmLabel}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

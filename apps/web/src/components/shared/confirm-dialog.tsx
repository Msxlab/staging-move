"use client";

import { useState } from "react";
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
      <div onClick={() => setOpen(true)}>{trigger}</div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-foreground/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <Card className="relative z-10 w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{description}</p>
              <div className="flex justify-end gap-3">
                <Button
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

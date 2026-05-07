"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <AlertTriangle className="h-16 w-16 text-destructive/40 mb-4" />
      <h2 className="text-xl font-semibold mb-2">{t("serverError")}</h2>
      <p className="text-muted-foreground mb-6 max-w-sm">
        {t("unexpectedShort")}
      </p>
      <Button onClick={reset}>{t("tryAgain")}</Button>
    </div>
  );
}

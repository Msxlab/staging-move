"use client";

import { Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";

interface UpgradePromptProps {
  feature: string;
  message?: string;
  compact?: boolean;
}

export default function UpgradePrompt({ feature, message, compact = false }: UpgradePromptProps) {
  const defaultMessage = `Upgrade your plan to unlock ${feature} and more premium features.`;

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-tone-orange-bg border border-tone-orange-br">
        <Sparkles className="h-4 w-4 text-tone-orange-fg shrink-0" />
        <p className="text-xs text-tone-orange-fg flex-1">{message || defaultMessage}</p>
        <Link href="/pricing">
          <button className="flex items-center gap-1 px-3 py-1 rounded-lg bg-tone-orange-fg text-white text-xs font-medium hover:opacity-90 transition whitespace-nowrap">
            Upgrade <ArrowRight className="h-3 w-3" />
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-tone-orange-br bg-gradient-to-br from-primary/10 to-transparent p-6 text-center">
      <div className="flex justify-center mb-3">
        <div className="p-3 rounded-2xl bg-tone-orange-bg">
          <Sparkles className="h-6 w-6 text-tone-orange-fg" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">Unlock {feature}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
        {message || defaultMessage}
      </p>
      <Link href="/pricing">
        <button className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-tone-orange-fg text-white text-sm font-medium hover:opacity-90 transition">
          View Plans <ArrowRight className="h-4 w-4" />
        </button>
      </Link>
    </div>
  );
}

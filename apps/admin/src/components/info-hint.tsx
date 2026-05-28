import { HelpCircle } from "lucide-react";

/**
 * Small inline help marker. Shows an explanatory native tooltip on hover and is
 * keyboard-focusable, so technical labels can carry a plain-language definition
 * without cluttering the layout.
 */
export function InfoHint({ text, label, className = "" }: { text: string; label?: string; className?: string }) {
  return (
    <span
      title={text}
      tabIndex={0}
      role="img"
      aria-label={label ? `${label}: ${text}` : text}
      className={`inline-flex cursor-help align-middle text-muted-foreground/60 transition-colors hover:text-muted-foreground focus:text-muted-foreground focus:outline-none ${className}`}
    >
      <HelpCircle className="h-3.5 w-3.5" />
    </span>
  );
}

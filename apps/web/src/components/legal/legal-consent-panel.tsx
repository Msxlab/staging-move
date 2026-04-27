"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileCheck2,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LEGAL_CONSENT_DOCUMENTS,
  getDefaultLegalConsents,
  type LegalConsentDocumentKey,
  type LegalConsentState,
} from "@/lib/legal";

const documentIcons = {
  terms: FileCheck2,
  disclaimer: ShieldAlert,
} as const;

type LegalConsentPanelProps = {
  consents: LegalConsentState;
  onChange: (next: LegalConsentState) => void;
  title?: string;
  description?: string;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
};

export function LegalConsentPanel({
  consents,
  onChange,
  title = "Required legal acknowledgements",
  description = "You must review and accept both documents before you can continue.",
  compact = false,
  disabled = false,
  className,
}: LegalConsentPanelProps) {
  const [expanded, setExpanded] = useState<LegalConsentDocumentKey | null>("terms");

  const updateConsent = (key: LegalConsentDocumentKey, checked: boolean) => {
    onChange(
      getDefaultLegalConsents({
        ...consents,
        [key === "terms" ? "termsAccepted" : "disclaimerAccepted"]: checked,
      }),
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-3">
        {LEGAL_CONSENT_DOCUMENTS.map((document) => {
          const Icon = documentIcons[document.key];
          const checked =
            document.key === "terms"
              ? consents.termsAccepted
              : consents.disclaimerAccepted;
          const isExpanded = expanded === document.key;
          const checkboxId = `legal-consent-${document.key}`;
          const summaryId = `legal-consent-${document.key}-summary`;

          return (
            <div key={document.key} className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => updateConsent(document.key, !checked)}
                  className={cn(
                    "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    checked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-transparent",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                  aria-pressed={checked}
                  aria-label={document.checkboxLabel}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>

                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-card-foreground">{document.title}</h3>
                          <p className="text-xs text-muted-foreground">
                            Versioned acknowledgement required before registration and onboarding continue.
                          </p>
                        </div>
                      </div>
                      <p id={summaryId} className="text-sm leading-6 text-muted-foreground">
                        {document.summary}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : document.key)}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? "Hide" : "Preview"}
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>

                  <ul className="space-y-1.5 rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground">
                    {document.highlights
                      .slice(0, compact ? 2 : document.highlights.length)
                      .map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="mt-1 text-primary">-</span>
                          <span>{item}</span>
                        </li>
                      ))}
                  </ul>

                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <Link
                      href={document.route}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-primary transition hover:text-primary/80"
                    >
                      View full document
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                    <span className="text-muted-foreground">
                      Open the full page in a new tab if you need the complete wording.
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="max-h-64 space-y-4 overflow-y-auto rounded-xl border border-border bg-background p-4">
                      {document.sections.map((section) => (
                        <div key={section.heading} className="space-y-2">
                          <h4 className="text-sm font-semibold text-foreground">{section.heading}</h4>
                          {section.paragraphs.map((paragraph) => (
                            <p key={paragraph} className="text-sm leading-6 text-muted-foreground">
                              {paragraph}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  <label
                    htmlFor={checkboxId}
                    className="flex items-start gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                  >
                    <input
                      id={checkboxId}
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-border bg-background accent-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      checked={checked}
                      disabled={disabled}
                      aria-describedby={summaryId}
                      onChange={(event) => updateConsent(document.key, event.target.checked)}
                    />
                    <span>{document.checkboxLabel}</span>
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

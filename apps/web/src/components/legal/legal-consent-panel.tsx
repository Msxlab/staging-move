"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, ChevronUp, ExternalLink, FileCheck2, ShieldAlert } from "lucide-react";
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
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-white/45">{description}</p>
      </div>
      <div className="space-y-3">
        {LEGAL_CONSENT_DOCUMENTS.map((document) => {
          const Icon = documentIcons[document.key];
          const checked = document.key === "terms" ? consents.termsAccepted : consents.disclaimerAccepted;
          const isExpanded = expanded === document.key;
          return (
            <div key={document.key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => updateConsent(document.key, !checked)}
                  className={cn(
                    "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition",
                    checked ? "border-orange-400 bg-orange-500 text-white" : "border-white/20 bg-white/5 text-transparent",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                  aria-pressed={checked}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-300">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">{document.title}</h3>
                          <p className="text-xs text-white/40">Versioned acknowledgement required before registration and onboarding continue.</p>
                        </div>
                      </div>
                      <p className="text-sm leading-6 text-white/60">{document.summary}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : document.key)}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50 transition hover:bg-white/10 hover:text-white/80"
                    >
                      {isExpanded ? "Hide" : "Preview"}
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  <label className="flex items-start gap-2 rounded-xl border border-white/10 bg-black/10 px-3 py-2.5 text-sm text-white/75">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 accent-orange-500"
                      checked={checked}
                      disabled={disabled}
                      onChange={(event) => updateConsent(document.key, event.target.checked)}
                    />
                    <span>{document.checkboxLabel}</span>
                  </label>

                  <ul className="space-y-1.5 text-sm text-white/55">
                    {document.highlights.slice(0, compact ? 2 : document.highlights.length).map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1 text-orange-300">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <Link href={document.route} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-orange-300 transition hover:text-orange-200">
                      View full document
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                    <span className="text-white/25">Open the full page in a new tab if you need the complete wording.</span>
                  </div>

                  {isExpanded && (
                    <div className="space-y-4 rounded-2xl border border-white/10 bg-black/10 p-4">
                      {document.sections.map((section) => (
                        <div key={section.heading} className="space-y-2">
                          <h4 className="text-sm font-semibold text-white">{section.heading}</h4>
                          {section.paragraphs.map((paragraph) => (
                            <p key={paragraph} className="text-sm leading-6 text-white/55">
                              {paragraph}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { X, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { PremiumSticker, type StickerStyle, type StickerTier } from "./premium-sticker";

interface RevealModalProps {
  open: boolean;
  tier: StickerTier;
  stickerStyle?: StickerStyle;
  userName?: string | null;
  onClose: () => void;
  onPrimary?: () => void;
  primaryLabel?: string;
  secondaryLabel?: string;
}

/**
 * Pro / Family upgrade celebration modal — the ritual moment.
 *
 * - Sticker zooms in with elastic bounce (1.2s)
 * - Foil glow + expanding ring loop in the background
 * - 24 confetti pieces (cool / foil / honey) fall over 2s
 * - Eyebrow → title → sub → buttons fade up in sequence
 * - Esc or backdrop click closes
 *
 * Style is locked to the design-system "honey and cool" palette and uses
 * the global `reveal-*` CSS in `apps/web/src/styles/globals.css`.
 */
export function RevealModal({
  open,
  tier,
  stickerStyle = "medal",
  userName,
  onClose,
  onPrimary,
  primaryLabel,
  secondaryLabel,
}: RevealModalProps) {
  const t = useTranslations("premiumReveal");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Confetti pieces are created once per open; randomized horizontal drift +
  // delay + duration give organic feel without per-frame work.
  const confetti = useMemo(
    () =>
      Array.from({ length: 24 }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        duration: 1.4 + Math.random() * 0.8,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  );

  if (!open) return null;

  const tierLabel = t(`tier_${tier}` as const);
  const subKey = `sub_${tier}` as const;

  return (
    <div
      className="reveal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reveal-title"
    >
      <div className="reveal-modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="reveal-close"
          onClick={onClose}
          aria-label={t("close")}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="reveal-confetti" aria-hidden="true">
          {confetti.map((c, i) => (
            <span
              key={i}
              style={{
                left: `${c.left}%`,
                animationDelay: `${c.delay}s`,
                animationDuration: `${c.duration}s`,
              }}
            />
          ))}
        </div>

        <div className="reveal-sticker-stage">
          <div className="reveal-sticker-zoom">
            <PremiumSticker tier={tier} style={stickerStyle} size={160} />
          </div>
        </div>

        <div className="reveal-eyebrow">
          {userName ? t("greetingNamed", { name: userName }) : t("greeting")}
        </div>
        <h2 id="reveal-title" className="reveal-title">
          {t.rich("titleHtml", {
            tier: tierLabel,
            em: (chunks) => <em>{chunks}</em>,
          })}
        </h2>
        <p className="reveal-sub">{t(subKey)}</p>

        <div className="reveal-actions">
          <button
            type="button"
            className="rounded-md border border-border/60 bg-foreground/[0.04] px-4 py-2 text-sm text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground transition-colors"
            onClick={onClose}
          >
            {secondaryLabel ?? t("secondary")}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[var(--foil-a)] via-[var(--foil-b)] to-[var(--foil-c)] px-4 py-2 text-sm font-medium text-[#1A1408] shadow-md hover:opacity-90 transition-all"
            onClick={() => {
              onPrimary?.();
              onClose();
            }}
          >
            <ArrowRight className="h-4 w-4" />
            {primaryLabel ?? t("primary")}
          </button>
        </div>
      </div>
    </div>
  );
}

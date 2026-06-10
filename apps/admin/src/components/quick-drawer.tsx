"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MINISTAT_TONE_COLOR,
  type MinistatTone,
} from "@/components/ministat-strip";

/**
 * QuickDrawer — Faz 3 right-hand quick-look overlay (432px).
 *
 * Scrim + slide-in panel with a header (entity initials disc or icon tile,
 * name, status pills), a 3-stat box row, free-form content sections, and a
 * footer action row whose primary action links to the full detail route.
 * The drawer AUGMENTS detail routes — it renders only data the list page
 * already has in memory (no new fetch) and always deep-links onward.
 *
 * Accessibility: role="dialog" + aria-modal, Escape and scrim-click close,
 * focus is trapped inside the panel while open and restored on close.
 * Visuals live in aurora.css under `.au-q*` (slate-light / aurora-dark).
 */

export interface QuickDrawerStat {
  value: ReactNode;
  label: string;
}

export interface QuickDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Mono uppercase header label, e.g. "Customer" or "Ticket". */
  eyebrow: string;
  /** Entity name (also feeds the dialog's accessible name). */
  title: string;
  subtitle?: string;
  /** Initials for the identity disc (ignored when `icon` is set). */
  initials?: string;
  /** Icon tile alternative to initials. */
  icon?: LucideIcon;
  tone?: MinistatTone;
  /** Status pills / tags rendered under the name. */
  meta?: ReactNode;
  /** 3-stat box row under the profile head. */
  stats?: QuickDrawerStat[];
  /** Content sections — compose with QuickDrawerSection / QuickDrawerRow. */
  children?: ReactNode;
  /** Footer actions. Primary should deep-link to the full detail route. */
  footer?: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function QuickDrawer({
  open,
  onClose,
  eyebrow,
  title,
  subtitle,
  initials,
  icon: Icon,
  tone = "cool",
  meta,
  stats,
  children,
  footer,
}: QuickDrawerProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // Focus management: remember the opener, focus the panel, trap Tab,
  // close on Escape, and restore focus when the drawer goes away.
  useEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement | null) ?? null;
    closeRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = active ? panel.contains(active) : false;
      if (e.shiftKey) {
        if (!inside || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  // Lock page scroll behind the overlay while open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const toneStyle = { "--c": MINISTAT_TONE_COLOR[tone] } as CSSProperties;

  return (
    <>
      <div className="au-qscrim" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        className="au-qdrawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${eyebrow}: ${title}`}
      >
        <div className="au-qdh">
          <span className="lbl">{eyebrow}</span>
          <button
            ref={closeRef}
            type="button"
            className="au-qdx"
            onClick={onClose}
            aria-label="Close quick look"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="au-qbody">
          <div className="au-qprofile">
            <span className="big" style={toneStyle} aria-hidden="true">
              {Icon ? <Icon className="h-6 w-6" /> : initials}
            </span>
            <div className="min-w-0">
              <div className="nm">{title}</div>
              {subtitle ? <div className="em">{subtitle}</div> : null}
              {meta ? <div className="meta">{meta}</div> : null}
            </div>
          </div>

          {stats && stats.length > 0 ? (
            <div className="au-qstats">
              {stats.map((stat) => (
                <div className="au-qstat" key={stat.label}>
                  <div className="v">{stat.value}</div>
                  <div className="k">{stat.label}</div>
                </div>
              ))}
            </div>
          ) : null}

          {children}
        </div>

        {footer ? <div className="au-qact">{footer}</div> : null}
      </aside>
    </>
  );
}

/** Mono uppercase section heading inside the drawer body. */
export function QuickDrawerSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="au-qsec">{title}</div>
      {children}
    </>
  );
}

/** One icon-tile row inside a drawer section. */
export function QuickDrawerRow({
  icon: Icon,
  tone = "cool",
  title,
  sub,
  className,
}: {
  icon: LucideIcon;
  tone?: MinistatTone;
  title: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("au-qrow", className)}
      style={{ "--c": MINISTAT_TONE_COLOR[tone] } as CSSProperties}
    >
      <span className="ti">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="b">
        <div className="t">{title}</div>
        {sub ? <div className="s">{sub}</div> : null}
      </div>
    </div>
  );
}

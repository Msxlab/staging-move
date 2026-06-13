"use client";

import { useEffect, useRef, useState } from "react";
import { Columns3, Check, Lock, RotateCcw } from "lucide-react";
import type { ResolvedColumn } from "@/hooks/use-column-visibility";

interface Props {
  columns: ResolvedColumn[];
  onToggle: (key: string) => void;
  onReset: () => void;
  hiddenCount: number;
}

/**
 * Dropdown menu that lets the operator show/hide columns on a list page.
 * Stateless — parent owns the persistence via useColumnVisibility.
 */
export function ColumnSettingsMenu({ columns, onToggle, onReset, hiddenCount }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Columns3 className="h-3.5 w-3.5" />
        Columns
        {hiddenCount > 0 ? (
          <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            {hiddenCount} hidden
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="fixed inset-x-2 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[60] max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-card shadow-lg sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:z-20 sm:mt-1 sm:max-h-none sm:w-56"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Visible columns
            </p>
            <button
              type="button"
              onClick={() => {
                onReset();
              }}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          </div>
          <ul className="max-h-80 overflow-y-auto py-1">
            {columns.map((col) => (
              <li key={col.key}>
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={col.visible}
                  disabled={col.alwaysOn}
                  onClick={() => onToggle(col.key)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-sm transition-colors ${
                    col.alwaysOn
                      ? "cursor-not-allowed text-muted-foreground"
                      : "text-foreground hover:bg-accent"
                  }`}
                >
                  <span className="truncate">{col.label}</span>
                  {col.alwaysOn ? (
                    <Lock className="h-3 w-3 text-muted-foreground" aria-label="Always visible" />
                  ) : col.visible ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <span className="h-4 w-4 rounded border border-border" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

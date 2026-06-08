"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, BookmarkPlus, Check, Trash2, X } from "lucide-react";
import type { SavedView } from "@/hooks/use-saved-views";

interface Props {
  views: SavedView[];
  /** Query that "Save current view" should snapshot. */
  currentQuery: Record<string, string>;
  /** The view (if any) whose query matches the current query exactly. */
  activeViewId: string | null;
  onApply: (view: SavedView) => void;
  onSave: (name: string, query: Record<string, string>) => void;
  onRemove: (id: string) => void;
}

/**
 * Saved/named-views dropdown for admin list pages. Stateless aside from its
 * own open/draft-name state — the parent (DataTablePage) owns persistence via
 * useSavedViews. Lets an operator apply a saved filter/sort/search snapshot,
 * save the current one under a name, or delete a saved view.
 */
export function SavedViewsMenu({
  views,
  currentQuery,
  activeViewId,
  onApply,
  onSave,
  onRemove,
}: Props) {
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!open) {
      setNaming(false);
      setDraftName("");
    }
  }, [open]);

  useEffect(() => {
    if (naming) nameInputRef.current?.focus();
  }, [naming]);

  const activeView = views.find((v) => v.id === activeViewId) || null;

  function commitSave() {
    const name = draftName.trim();
    if (!name) return;
    onSave(name, currentQuery);
    setNaming(false);
    setDraftName("");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Bookmark className="h-3.5 w-3.5" />
        {activeView ? (
          <span className="max-w-[10rem] truncate text-foreground">{activeView.name}</span>
        ) : (
          "Views"
        )}
        {views.length > 0 ? (
          <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            {views.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-border bg-card shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Saved views
            </p>
          </div>

          <ul className="max-h-72 overflow-y-auto py-1">
            {views.length === 0 ? (
              <li className="px-3 py-3 text-xs text-muted-foreground">
                No saved views yet. Filter the table, then save the current view.
              </li>
            ) : (
              views.map((view) => {
                const active = view.id === activeViewId;
                return (
                  <li key={view.id} className="group flex items-center">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onApply(view);
                        setOpen(false);
                      }}
                      className={`flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent ${
                        active ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {active ? (
                        <Check className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <Bookmark className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate">{view.name}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete view ${view.name}`}
                      onClick={() => onRemove(view.id)}
                      className="mr-1 rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <div className="border-t border-border p-2">
            {naming ? (
              <div className="flex items-center gap-1.5">
                <input
                  ref={nameInputRef}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitSave();
                    if (e.key === "Escape") {
                      setNaming(false);
                      setDraftName("");
                    }
                  }}
                  placeholder="View name…"
                  maxLength={40}
                  className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={commitSave}
                  disabled={!draftName.trim()}
                  className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  aria-label="Cancel"
                  onClick={() => {
                    setNaming(false);
                    setDraftName("");
                  }}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setNaming(true)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-accent"
              >
                <BookmarkPlus className="h-4 w-4 text-muted-foreground" />
                Save current view
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

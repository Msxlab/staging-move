"use client";

/**
 * Category picker for the post editor.
 *
 * Loads categories scoped to the post's locale on mount (and when
 * the locale flips), shows them as a select with an inline "create new"
 * affordance. Categories are unique per (slug, locale) — when the
 * editor types a name that resolves to an existing slug we silently
 * adopt the existing row so we don't end up with two rose-coloured
 * "moving" rows.
 */

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  slug: string;
  name: string;
  locale: string;
}

interface CategoryPickerProps {
  locale: string;
  value: string | null;
  onChange: (categoryId: string | null) => void;
  disabled?: boolean;
}

export function CategoryPicker({ locale, value, onChange, disabled }: CategoryPickerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/blog/categories?locale=${locale}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { categories: Category[] };
      setCategories(data.categories);
    } catch {
      // Soft-fail — the picker is optional. The editor still saves.
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  async function createCategory() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/blog/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), locale }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { category: Category; reused: boolean };
      setCategories((prev) => {
        const exists = prev.some((c) => c.id === data.category.id);
        return exists ? prev : [...prev, data.category];
      });
      onChange(data.category.id);
      setNewName("");
      setShowCreate(false);
      if (data.reused) {
        toast.message("Reusing existing category", {
          description: `Adopted "${data.category.name}" so you don't get duplicate slugs.`,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create category");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor="category-select">
        Category
      </label>
      {loading ? (
        <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-muted/30 px-3 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading…
        </div>
      ) : showCreate ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void createCategory();
              }
              if (e.key === "Escape") {
                setShowCreate(false);
                setNewName("");
              }
            }}
            placeholder="New category name"
            disabled={creating}
            autoFocus
            maxLength={100}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            onClick={() => void createCategory()}
            disabled={creating || !newName.trim()}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCreate(false);
              setNewName("");
            }}
            disabled={creating}
            className="inline-flex items-center rounded-md border border-border px-2 py-2 text-foreground hover:bg-accent"
            aria-label="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <select
            id="category-select"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={disabled}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="">— Uncategorized —</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-foreground transition hover:bg-accent disabled:opacity-50"
            aria-label="Create new category"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

/**
 * Tag picker for the post editor.
 *
 * Tags are flat per-locale. We let the editor multi-select existing
 * tags or type a new one and create it inline (the API silently
 * adopts an existing row if the slug collides). The selection is
 * sent back to the post PATCH route as `tagIds: string[]`.
 *
 * Mirrors CategoryPicker's affordances so the editor doesn't have to
 * learn two interaction patterns.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Tag, X } from "lucide-react";
import { toast } from "sonner";

interface BlogTagOption {
  id: string;
  slug: string;
  name: string;
  locale: string;
}

interface TagPickerProps {
  locale: string;
  value: string[];
  onChange: (tagIds: string[]) => void;
  disabled?: boolean;
}

const labelClass = "mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground";

export function TagPicker({ locale, value, onChange, disabled }: TagPickerProps) {
  const [tags, setTags] = useState<BlogTagOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const loadTags = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/blog/tags?locale=${encodeURIComponent(locale)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { tags: BlogTagOption[] };
      setTags(data.tags ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load tags");
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const selectedTags = useMemo(
    () => tags.filter((tag) => selectedSet.has(tag.id)),
    [tags, selectedSet],
  );

  function toggle(tagId: string) {
    if (selectedSet.has(tagId)) {
      onChange(value.filter((id) => id !== tagId));
    } else {
      onChange([...value, tagId]);
    }
  }

  async function createTag() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/blog/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, locale }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { tag: BlogTagOption };
      setTags((current) => {
        if (current.some((tag) => tag.id === data.tag.id)) return current;
        return [...current, data.tag].sort((a, b) => a.name.localeCompare(b.name));
      });
      onChange(Array.from(new Set([...value, data.tag.id])));
      setNewName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create tag");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <label className={labelClass}>Tags</label>
      <div className="flex flex-wrap items-center gap-1">
        {selectedTags.length === 0 ? (
          <span className="text-xs text-muted-foreground">No tags selected.</span>
        ) : (
          selectedTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggle(tag.id)}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
            >
              <Tag className="h-3 w-3" />
              {tag.name}
              <X className="h-3 w-3" />
            </button>
          ))
        )}
      </div>

      {loading ? (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading tags...
        </p>
      ) : (
        <>
          {tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {tags
                .filter((tag) => !selectedSet.has(tag.id))
                .map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggle(tag.id)}
                    disabled={disabled}
                    className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent disabled:opacity-50"
                  >
                    {tag.name}
                  </button>
                ))}
            </div>
          ) : null}
          <div className="mt-2 flex items-center gap-1">
            <input
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void createTag();
                }
              }}
              disabled={disabled || creating}
              placeholder="Add new tag..."
              maxLength={100}
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={() => void createTag()}
              disabled={disabled || creating || !newName.trim()}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Add
            </button>
          </div>
        </>
      )}
    </div>
  );
}

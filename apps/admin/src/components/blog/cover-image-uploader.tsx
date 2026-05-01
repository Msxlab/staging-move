"use client";

/**
 * Cover image uploader for the post editor.
 *
 * Drag-and-drop or click-to-pick. Hits `POST /api/blog/uploads`, gets
 * back an R2 object key, and bubbles it up via `onChange`. We display
 * the imgproxy-passthrough URL (`/api/blog/image?key=...`) for the
 * preview so the editor sees the same render the public site will.
 *
 * The key — not the URL — is the canonical value persisted on the
 * post. URL composition (signing, format, dimensions) happens on read
 * via `buildBlogOgImageUrl`; if we ever rotate the imgproxy key, no
 * post needs to be touched.
 */

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface CoverImageUploaderProps {
  ogImageKey: string;
  ogImageAlt: string;
  onChange: (next: { ogImageKey: string; ogImageAlt: string }) => void;
  disabled?: boolean;
}

const MAX_BYTES = 5 * 1024 * 1024; // matches admin/src/lib/blog-uploads
const ACCEPTED = "image/jpeg,image/png,image/webp,image/avif";

export function CoverImageUploader({
  ogImageKey,
  ogImageAlt,
  onChange,
  disabled,
}: CoverImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const previewSrc = ogImageKey ? `/api/blog/image?key=${encodeURIComponent(ogImageKey)}` : null;

  const upload = useCallback(
    async (file: File) => {
      if (disabled) return;
      if (!file.type.startsWith("image/")) {
        toast.error("Please pick an image file");
        return;
      }
      if (file.size > MAX_BYTES) {
        toast.error("Cover images must be under 5 MB");
        return;
      }
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/blog/uploads", { method: "POST", body: fd });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `Upload failed (HTTP ${res.status})`);
        }
        const { key } = (await res.json()) as { key: string };
        onChange({ ogImageKey: key, ogImageAlt });
        toast.success("Cover image uploaded");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [disabled, onChange, ogImageAlt],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void upload(file);
    },
    [upload],
  );

  return (
    <div className="space-y-3">
      {previewSrc ? (
        <div className="group relative overflow-hidden rounded-lg border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewSrc}
            alt={ogImageAlt || "Cover preview"}
            className="aspect-[1200/630] w-full object-cover"
          />
          <button
            type="button"
            onClick={() => onChange({ ogImageKey: "", ogImageAlt })}
            disabled={disabled || uploading}
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-border bg-background/90 px-2 py-1 text-xs text-foreground shadow-sm backdrop-blur transition hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
            aria-label="Remove cover"
          >
            <Trash2 className="h-3 w-3" />
            Remove
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          aria-label="Upload cover image"
          className={
            "flex aspect-[1200/630] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-center transition " +
            (dragActive
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50")
          }
        >
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Uploading…</p>
            </>
          ) : (
            <>
              <ImagePlus className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Drop a cover image</p>
              <p className="text-xs text-muted-foreground">
                or click — JPG, PNG, WebP, AVIF · up to 5 MB · 1200×630 ideal
              </p>
            </>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor="cover-alt">
          Alt text
        </label>
        <input
          id="cover-alt"
          value={ogImageAlt}
          onChange={(e) => onChange({ ogImageKey, ogImageAlt: e.target.value })}
          maxLength={200}
          placeholder="Describes the image for screen readers and search engines"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>
    </div>
  );
}

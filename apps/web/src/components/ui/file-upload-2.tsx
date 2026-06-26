"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Receipt,
  File as FileIcon,
  X,
  CheckCircle2,
  Loader2,
} from "lucide-react";

/* ---------------------------------------------------------------------------
 * FileUpload2 — LocateFlow dossier / document uploader.
 *
 * Re-themed off the watermelon "file-upload-2" registry component (which used
 * hardcoded indigo/violet accents and zinc greys with dark:#hex overrides).
 * Every surface, border, accent and success state now resolves through our
 * sapphire CSS-var theme (bg-card / bg-muted / border-border / text-primary /
 * text-success). ZERO gold/amber, no dark:#hex — theming flows via .light/.dark.
 *
 * Repurposed copy + logic: drag-drop leases, mover quotes, and bank /
 * subscription statements into the move dossier. The size + simulated upload
 * progress UI is preserved; on completion each file is surfaced as "ready"
 * which downstream feeds both the dossier and the statement -> AI
 * subscription-import flow.
 * ------------------------------------------------------------------------- */

export interface UploadedDoc {
  id: string;
  name: string;
  size: number;
  kind: DocKind;
  progress: number; // 0–100
  status: "uploading" | "ready";
}

type DocKind = "lease" | "quote" | "statement" | "other";

interface FileUpload2Props {
  /** Accept attribute for the hidden input. */
  accept?: string;
  /** Max single-file size in bytes (default 25 MB). */
  maxSize?: number;
  /** Fires whenever the ready set changes (dossier / AI-import hook). */
  onReadyChange?: (docs: UploadedDoc[]) => void;
}

const MB = 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

/** Classify a dropped file by name so the dossier knows where it belongs. */
function classify(name: string): DocKind {
  const n = name.toLowerCase();
  if (n.includes("lease") || n.includes("tenancy") || n.includes("rent")) return "lease";
  if (n.includes("quote") || n.includes("estimate") || n.includes("mover")) return "quote";
  if (n.includes("statement") || n.includes("bank") || n.includes("transactions"))
    return "statement";
  return "other";
}

const KIND_META: Record<DocKind, { label: string; icon: React.ReactNode }> = {
  lease: { label: "Lease", icon: <FileText className="h-5 w-5" /> },
  quote: { label: "Mover quote", icon: <Receipt className="h-5 w-5" /> },
  statement: { label: "Statement", icon: <FileSpreadsheet className="h-5 w-5" /> },
  other: { label: "Document", icon: <FileIcon className="h-5 w-5" /> },
};

export const FileUpload2: React.FC<FileUpload2Props> = ({
  accept = ".pdf,.csv,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx",
  maxSize = 25 * MB,
  onReadyChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const emitReady = useCallback(
    (next: UploadedDoc[]) => {
      onReadyChange?.(next.filter((d) => d.status === "ready"));
    },
    [onReadyChange],
  );

  const simulateUpload = useCallback(
    (id: string) => {
      timers.current[id] = setInterval(() => {
        setDocs((prev) => {
          const next: UploadedDoc[] = prev.map((d) => {
            if (d.id !== id) return d;
            const bump = Math.random() * 22 + 8;
            const progress = Math.min(100, d.progress + bump);
            const status: UploadedDoc["status"] =
              progress >= 100 ? "ready" : "uploading";
            return { ...d, progress, status };
          });
          const done = next.find((d) => d.id === id && d.status === "ready");
          if (done) {
            clearInterval(timers.current[id]);
            delete timers.current[id];
            emitReady(next);
          }
          return next;
        });
      }, 360);
    },
    [emitReady],
  );

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      setError(null);
      const incoming = Array.from(fileList);
      const accepted: UploadedDoc[] = [];
      for (const f of incoming) {
        if (f.size > maxSize) {
          setError(`${f.name} is larger than ${formatSize(maxSize)} and was skipped.`);
          continue;
        }
        accepted.push({
          id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: f.name,
          size: f.size,
          kind: classify(f.name),
          progress: 0,
          status: "uploading",
        });
      }
      if (accepted.length === 0) return;
      setDocs((prev) => [...accepted, ...prev]);
      accepted.forEach((d) => simulateUpload(d.id));
    },
    [maxSize, simulateUpload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const removeDoc = useCallback(
    (id: string) => {
      if (timers.current[id]) {
        clearInterval(timers.current[id]);
        delete timers.current[id];
      }
      setDocs((prev) => {
        const next = prev.filter((d) => d.id !== id);
        emitReady(next);
        return next;
      });
    },
    [emitReady],
  );

  return (
    <div className="w-full max-w-xl font-sans">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/40 hover:border-primary/50 hover:bg-muted/60"
        }`}
      >
        <div
          className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
            isDragging ? "bg-primary text-primary-foreground" : "bg-card text-primary"
          }`}
        >
          <UploadCloud className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-foreground">
          Drop leases, mover quotes &amp; statements here
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          or <span className="font-medium text-primary">browse files</span> — PDF, CSV, or
          images up to {formatSize(maxSize)}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <p className="mt-3 text-xs font-medium text-destructive">{error}</p>
      )}

      {/* File list */}
      {docs.length > 0 && (
        <ul className="mt-4 space-y-2">
          {docs.map((doc) => {
            const meta = KIND_META[doc.kind];
            const ready = doc.status === "ready";
            return (
              <li
                key={doc.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    ready ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {meta.icon}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{doc.name}</p>
                    <button
                      type="button"
                      onClick={() => removeDoc(doc.id)}
                      aria-label={`Remove ${doc.name}`}
                      className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-1.5 py-0.5 font-medium">
                      {meta.label}
                    </span>
                    <span>{formatSize(doc.size)}</span>
                    <span className="ml-auto flex items-center gap-1">
                      {ready ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                          <span className="font-medium text-success">Ready</span>
                        </>
                      ) : (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                          <span>{Math.round(doc.progress)}%</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Progress track */}
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        ready ? "bg-success" : "bg-primary"
                      }`}
                      style={{ width: `${doc.progress}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default FileUpload2;

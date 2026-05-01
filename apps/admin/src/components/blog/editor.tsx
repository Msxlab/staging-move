"use client";

/**
 * Blog content editor (Tiptap).
 *
 * Outputs Tiptap's JSON document, which the API endpoint renders to
 * HTML on the server (`generateHTML(json, schema)`) and then sanitizes
 * via `sanitizeBlogHtml`. We never trust the editor's HTML output —
 * the JSON tree is the canonical source.
 *
 * Image handling: the toolbar's "Insert image" button uploads via
 * `POST /api/blog/uploads`, gets back an R2 key, and inserts an
 * `<img src="<imgproxy URL>">` node. The same key is what gets
 * persisted; rendering re-derives the imgproxy URL.
 *
 * This is the Sprint 1 scaffold — Sprint 2 layers on slash-commands,
 * autosave, slug field, SEO sidebar, scheduled-publish picker, etc.
 */

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useState } from "react";

interface BlogEditorProps {
  /** Initial Tiptap JSON document (null on a fresh post). */
  initialContent?: object | null;
  /** Called on every change with the latest Tiptap JSON. */
  onChange: (json: object) => void;
  /** When true, disable the toolbar (e.g. while saving). */
  disabled?: boolean;
}

export function BlogEditor({ initialContent, onChange, disabled }: BlogEditorProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] }, // H1 is reserved for the post title
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ["http", "https", "mailto"],
        HTMLAttributes: {
          rel: "nofollow ugc noopener noreferrer",
          target: "_blank",
        },
      }),
      Image.configure({
        // We always upload through our endpoint; the editor never
        // accepts arbitrary user-pasted image URLs (those would skip
        // R2 + imgproxy and break our CSP).
        allowBase64: false,
        HTMLAttributes: { loading: "lazy" },
      }),
      Placeholder.configure({
        placeholder: "Tell the story…",
      }),
    ],
    content: initialContent || "",
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  const insertImage = useCallback(async () => {
    if (!editor) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/avif";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(true);
      setUploadError(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/blog/uploads", { method: "POST", body: fd });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        const { key } = (await res.json()) as { key: string };
        // Render through imgproxy. We don't have the runtime imgproxy
        // host in the browser bundle, so we reference the R2 key via
        // a same-origin proxy route the public site exposes.
        const src = `/api/blog/image?key=${encodeURIComponent(key)}`;
        editor.chain().focus().setImage({ src }).run();
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }, [editor]);

  if (!editor) return null;

  const Btn = ({
    onClick,
    active,
    children,
    label,
  }: {
    onClick: () => void;
    active?: boolean;
    children: React.ReactNode;
    label: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={!!active}
      disabled={disabled}
      className={`px-2 py-1 text-sm border rounded ${active ? "bg-zinc-200 dark:bg-zinc-700" : ""}`}
    >
      {children}
    </button>
  );

  return (
    <div className="border rounded-md">
      <div className="flex flex-wrap gap-1 p-2 border-b bg-zinc-50 dark:bg-zinc-900">
        <Btn
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          label="Heading 2"
        >
          H2
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          label="Heading 3"
        >
          H3
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          label="Bold"
        >
          B
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          label="Italic"
        >
          <em>I</em>
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          label="Bullet list"
        >
          •
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          label="Numbered list"
        >
          1.
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          label="Blockquote"
        >
          ❝
        </Btn>
        <Btn
          onClick={() => {
            const url = window.prompt("URL");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          active={editor.isActive("link")}
          label="Insert link"
        >
          🔗
        </Btn>
        <Btn onClick={insertImage} label="Insert image">
          🖼
        </Btn>
        {uploading ? <span className="text-xs px-2 py-1 text-zinc-500">Uploading…</span> : null}
        {uploadError ? (
          <span className="text-xs px-2 py-1 text-red-600">{uploadError}</span>
        ) : null}
      </div>
      <EditorContent
        editor={editor}
        className="prose prose-zinc dark:prose-invert max-w-none p-4 min-h-[300px] focus:outline-none"
      />
    </div>
  );
}

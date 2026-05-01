"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, Eye, Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BlogEditor } from "./editor";
import { CoverImageUploader } from "./cover-image-uploader";
import { CategoryPicker } from "./category-picker";
import { SeoScore } from "./seo-score";

type BlogStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
type BlogLocale = "en" | "es";

interface LoadedPost {
  id: string;
  slug: string;
  locale: BlogLocale;
  title: string;
  excerpt: string;
  contentJson: object | null;
  contentText?: string | null;
  status: BlogStatus;
  publishedAt: string | null;
  scheduledAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  noIndex: boolean;
  ogImageKey: string | null;
  ogImageAlt: string | null;
  categoryId: string | null;
}

interface FormState {
  title: string;
  slug: string;
  locale: BlogLocale;
  excerpt: string;
  contentJson: object | null;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  noIndex: boolean;
  ogImageKey: string;
  ogImageAlt: string;
  scheduledAt: string;
  categoryId: string | null;
}

const emptyDoc = { type: "doc", content: [{ type: "paragraph" }] };

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

const labelClass = "mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground";
const PUBLIC_WEB_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://locateflow.app").replace(/\/+$/, "");

function toLocalInputValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromLocalInputValue(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizePost(post: LoadedPost): FormState {
  return {
    title: post.title,
    slug: post.slug,
    locale: post.locale,
    excerpt: post.excerpt || "",
    contentJson: post.contentJson || emptyDoc,
    seoTitle: post.seoTitle || "",
    seoDescription: post.seoDescription || "",
    canonicalUrl: post.canonicalUrl || "",
    noIndex: !!post.noIndex,
    ogImageKey: post.ogImageKey || "",
    ogImageAlt: post.ogImageAlt || "",
    scheduledAt: toLocalInputValue(post.scheduledAt),
    categoryId: post.categoryId ?? null,
  };
}

function tiptapToText(doc: object | null | undefined): string {
  if (!doc || typeof doc !== "object") return "";
  // Cheap client-side text extractor for the SEO body-length lint.
  // The server is the source of truth (renderBlogContent → htmlToText)
  // and writes `contentText` on save; this is only a live preview.
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (typeof n.text === "string") out.push(n.text);
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(doc);
  return out.join(" ");
}

async function readError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return typeof body?.error === "string" ? body.error : `HTTP ${res.status}`;
}

export function BlogPostEditorShell({ postId }: { postId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(!!postId);
  const [saving, setSaving] = useState(false);
  const [post, setPost] = useState<LoadedPost | null>(null);
  const [form, setForm] = useState<FormState>({
    title: "",
    slug: "",
    locale: "en",
    excerpt: "",
    contentJson: emptyDoc,
    seoTitle: "",
    seoDescription: "",
    canonicalUrl: "",
    noIndex: false,
    ogImageKey: "",
    ogImageAlt: "",
    scheduledAt: "",
    categoryId: null,
  });

  const isExisting = !!postId;
  const canSave = form.title.trim().length > 0 && !saving;
  const publicUrl = useMemo(() => {
    if (!post?.slug) return null;
    return `${PUBLIC_WEB_URL}/blog/${post.slug}${post.locale === "es" ? "?locale=es" : ""}`;
  }, [post?.locale, post?.slug]);

  const loadPost = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/blog/posts/${postId}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { post: LoadedPost };
      setPost(data.post);
      setForm(normalizePost(data.post));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load post");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void loadPost();
  }, [loadPost]);

  async function createPost() {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/blog/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          locale: form.locale,
          slug: form.slug.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const created = (await res.json()) as { id: string };
      toast.success("Draft created");
      router.replace(`/blog/${created.id}/edit`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create post");
    } finally {
      setSaving(false);
    }
  }

  async function savePost(options: { silent?: boolean } = {}) {
    if (!postId) {
      await createPost();
      return false;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/blog/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          slug: form.slug.trim(),
          locale: form.locale,
          excerpt: form.excerpt,
          contentJson: form.contentJson || emptyDoc,
          seoTitle: form.seoTitle.trim() || null,
          seoDescription: form.seoDescription.trim() || null,
          canonicalUrl: form.canonicalUrl.trim() || null,
          noIndex: form.noIndex,
          ogImageKey: form.ogImageKey.trim() || null,
          ogImageAlt: form.ogImageAlt.trim() || null,
          categoryId: form.categoryId,
          scheduledAt: fromLocalInputValue(form.scheduledAt) ?? null,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { post: Pick<LoadedPost, "id" | "slug" | "locale" | "status" | "title"> };
      setPost((current) =>
        current
          ? { ...current, ...data.post, ...form, scheduledAt: fromLocalInputValue(form.scheduledAt) ?? null }
          : null,
      );
      if (!options.silent) toast.success("Post saved");
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save post");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function runLifecycle(action: "publish" | "schedule" | "unpublish") {
    if (!postId) {
      toast.error("Create the draft before publishing");
      return;
    }
    const saved = await savePost({ silent: true });
    if (!saved) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/blog/posts/${postId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          scheduledAt: action === "schedule" ? fromLocalInputValue(form.scheduledAt) : undefined,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      toast.success(action === "publish" ? "Published" : action === "schedule" ? "Scheduled" : "Unpublished");
      await loadPost();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setSaving(false);
    }
  }

  async function openPreview() {
    if (!postId) {
      toast.error("Create the draft before previewing");
      return;
    }
    const saved = await savePost({ silent: true });
    if (!saved) return;
    try {
      const res = await fetch(`/api/blog/posts/${postId}/preview-token`, { method: "POST" });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { url: string };
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create preview");
    }
  }

  async function deletePost() {
    if (!postId) return;
    if (!window.confirm("Delete this blog post?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/blog/posts/${postId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res));
      toast.success("Post deleted");
      router.replace("/blog");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading post...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Blog
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">
            {isExisting ? "Edit blog post" : "New blog post"}
          </h1>
          {post ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Status: <span className="font-medium text-foreground">{post.status}</span>
              {publicUrl ? (
                <>
                  {" "}
                  / Public:{" "}
                  <Link href={publicUrl} target="_blank" className="underline">
                    {publicUrl}
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {postId ? (
            <button
              type="button"
              onClick={openPreview}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
            >
              <Eye className="h-4 w-4" />
              Preview
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void savePost()}
            disabled={!canSave}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {postId ? "Save" : "Create draft"}
          </button>
          {postId ? (
            <>
              <button
                type="button"
                onClick={() => void runLifecycle("schedule")}
                disabled={saving || !form.scheduledAt}
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
              >
                <CalendarClock className="h-4 w-4" />
                Schedule
              </button>
              {post?.status === "PUBLISHED" ? (
                <button
                  type="button"
                  onClick={() => void runLifecycle("unpublish")}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
                >
                  Unpublish
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void runLifecycle("publish")}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  Publish
                </button>
              )}
              <button
                type="button"
                onClick={deletePost}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <label className={labelClass} htmlFor="blog-title">
              Title
            </label>
            <input
              id="blog-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full border-0 bg-transparent p-0 text-3xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="Post title"
            />
          </div>

          {postId ? (
            <BlogEditor
              initialContent={form.contentJson || emptyDoc}
              onChange={(contentJson) => setForm((f) => ({ ...f, contentJson }))}
              disabled={saving}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Create the draft first, then the full editor will open.
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Cover image</h2>
            <CoverImageUploader
              ogImageKey={form.ogImageKey}
              ogImageAlt={form.ogImageAlt}
              onChange={({ ogImageKey, ogImageAlt }) =>
                setForm((f) => ({ ...f, ogImageKey, ogImageAlt }))
              }
              disabled={saving}
            />
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Discoverability</h2>
            <SeoScore
              title={form.title}
              seoTitle={form.seoTitle}
              excerpt={form.excerpt}
              seoDescription={form.seoDescription}
              slug={form.slug}
              ogImageKey={form.ogImageKey}
              ogImageAlt={form.ogImageAlt}
              contentText={post?.contentText ?? tiptapToText(form.contentJson)}
            />
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Post settings</h2>
            <div className="space-y-3">
              <div>
                <label className={labelClass} htmlFor="blog-slug">
                  Slug
                </label>
                <input
                  id="blog-slug"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  className={inputClass}
                  placeholder="moving-checklist"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Lowercase, dashes only. Leave empty to auto-generate from the title.
                </p>
              </div>
              <div>
                <label className={labelClass} htmlFor="blog-locale">
                  Locale
                </label>
                <select
                  id="blog-locale"
                  value={form.locale}
                  onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value as BlogLocale }))}
                  className={inputClass}
                >
                  <option value="en">English (US)</option>
                  <option value="es">Spanish (US)</option>
                </select>
              </div>
              <CategoryPicker
                locale={form.locale}
                value={form.categoryId}
                onChange={(categoryId) => setForm((f) => ({ ...f, categoryId }))}
                disabled={saving}
              />
              <div>
                <label className={labelClass} htmlFor="blog-excerpt">
                  Excerpt
                </label>
                <textarea
                  id="blog-excerpt"
                  value={form.excerpt}
                  onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                  className={inputClass}
                  rows={4}
                  maxLength={500}
                  placeholder="Short summary for cards and search previews"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="blog-scheduled">
                  Scheduled time
                </label>
                <input
                  id="blog-scheduled"
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">SEO meta</h2>
            <div className="space-y-3">
              <div>
                <label className={labelClass} htmlFor="seo-title">
                  SEO title
                </label>
                <input
                  id="seo-title"
                  value={form.seoTitle}
                  onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))}
                  className={inputClass}
                  maxLength={200}
                  placeholder="Falls back to the post title"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="seo-description">
                  Meta description
                </label>
                <textarea
                  id="seo-description"
                  value={form.seoDescription}
                  onChange={(e) => setForm((f) => ({ ...f, seoDescription: e.target.value }))}
                  className={inputClass}
                  rows={3}
                  maxLength={320}
                  placeholder="Falls back to the excerpt"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="canonical-url">
                  Canonical URL
                </label>
                <input
                  id="canonical-url"
                  value={form.canonicalUrl}
                  onChange={(e) => setForm((f) => ({ ...f, canonicalUrl: e.target.value }))}
                  className={inputClass}
                  placeholder="https://locateflow.app/blog/post"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.noIndex}
                  onChange={(e) => setForm((f) => ({ ...f, noIndex: e.target.checked }))}
                  className="accent-primary"
                />
                Noindex this post
              </label>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

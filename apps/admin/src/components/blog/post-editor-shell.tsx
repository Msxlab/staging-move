"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarClock, Eye, Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BlogEditor } from "./editor";
import { CoverImageUploader } from "./cover-image-uploader";
import { CategoryPicker } from "./category-picker";
import { TagPicker } from "./tag-picker";
import { SeoScore } from "./seo-score";
import { ConfirmDialog } from "@/components/confirm-dialog";

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
  tags?: Array<{ tag: { id: string; slug: string; name: string; locale: string } }>;
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
  tagIds: string[];
}

const emptyDoc = { type: "doc", content: [{ type: "paragraph" }] };

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

const labelClass = "mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground";
const PUBLIC_WEB_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://locateflow.com").replace(/\/+$/, "");

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
    tagIds: (post.tags ?? []).map((entry) => entry.tag.id),
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

const AUTOSAVE_INTERVAL_MS = 30_000;

export function BlogPostEditorShell({ postId }: { postId?: string }) {
  const [loading, setLoading] = useState(!!postId);
  const [saving, setSaving] = useState(false);
  const [autosaving, setAutosaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
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
    tagIds: [],
  });

  const isExisting = !!postId;
  const canSave = form.title.trim().length > 0 && !saving;
  const publicUrl = useMemo(() => {
    if (!post?.slug) return null;
    return `${PUBLIC_WEB_URL}/blog/${post.slug}${post.locale === "es" ? "?locale=es" : ""}`;
  }, [post?.locale, post?.slug]);

  // Autosave plumbing: snapshot the form into refs so the interval
  // can compare without re-creating itself every keystroke. The
  // interval reads the *latest* save function via a ref so the
  // closure doesn't go stale during a long editing session.
  const formSnapshotRef = useRef<string>("");
  const lastSavedSnapshotRef = useRef<string>("");
  const savePostRef = useRef<((options?: { silent?: boolean }) => Promise<boolean>) | null>(null);
  useEffect(() => {
    formSnapshotRef.current = JSON.stringify(form);
  }, [form]);

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

  // After a load resets the form, mark the snapshot as "saved" so the
  // autosave doesn't immediately fire just because we hydrated.
  useEffect(() => {
    if (!loading && post) {
      lastSavedSnapshotRef.current = JSON.stringify(normalizePost(post));
      formSnapshotRef.current = lastSavedSnapshotRef.current;
    }
  }, [loading, post]);

  // Autosave: every 30s, if the form differs from what was last saved,
  // POST a silent PATCH. Skip while a manual save is in flight or the
  // post hasn't been created yet (no postId means there's nothing to
  // patch — the user must hit "Create draft" first).
  useEffect(() => {
    if (!postId) return;
    const interval = setInterval(() => {
      if (saving || autosaving || loading) return;
      if (!formSnapshotRef.current || formSnapshotRef.current === lastSavedSnapshotRef.current) return;
      const fn = savePostRef.current;
      if (!fn) return;
      void (async () => {
        const expectedSnapshot = formSnapshotRef.current;
        setAutosaving(true);
        try {
          const ok = await fn({ silent: true });
          if (ok) {
            lastSavedSnapshotRef.current = expectedSnapshot;
            setLastSavedAt(new Date());
          }
        } finally {
          setAutosaving(false);
        }
      })();
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [postId, saving, autosaving, loading]);

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
      window.location.replace(`/blog/${created.id}/edit`);
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
    if (!options.silent) setSaving(true);
    try {
      const res = await fetch(`/api/blog/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          slug: form.slug.trim(),
          locale: form.locale,
          excerpt: form.excerpt.trim() || undefined,
          contentJson: form.contentJson || emptyDoc,
          seoTitle: form.seoTitle.trim() || null,
          seoDescription: form.seoDescription.trim() || null,
          canonicalUrl: form.canonicalUrl.trim() || null,
          noIndex: form.noIndex,
          ogImageKey: form.ogImageKey.trim() || null,
          ogImageAlt: form.ogImageAlt.trim() || null,
          categoryId: form.categoryId,
          tagIds: form.tagIds,
          scheduledAt: fromLocalInputValue(form.scheduledAt) ?? null,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { post: Pick<LoadedPost, "id" | "slug" | "locale" | "status" | "title">; revalidate?: { ok?: boolean; reason?: string } };
      setPost((current) =>
        current
          ? { ...current, ...data.post, ...form, scheduledAt: fromLocalInputValue(form.scheduledAt) ?? null }
          : null,
      );
      if (!options.silent) toast.success("Post saved");
      if (data.revalidate && data.revalidate.ok === false) {
        toast.warning(
          data.revalidate.reason === "config-missing"
            ? "Public cache refresh skipped — webhook secret missing."
            : "Public cache refresh failed. The site will catch up within 10 minutes.",
        );
      }
      lastSavedSnapshotRef.current = formSnapshotRef.current;
      setLastSavedAt(new Date());
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save post");
      return false;
    } finally {
      if (!options.silent) setSaving(false);
    }
  }

  // Keep the autosave interval pointing at the latest savePost. We
  // can't pass `savePost` directly into the dependency array of the
  // autosave effect — it'd recreate the interval on every keystroke.
  useEffect(() => {
    savePostRef.current = savePost;
  });

  async function runLifecycle(action: "publish" | "schedule" | "unpublish" | "cancel-schedule") {
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
      const data = (await res.json().catch(() => ({}))) as {
        revalidate?: { ok?: boolean; reason?: string };
      };
      toast.success(
        action === "publish"
          ? "Published"
          : action === "schedule"
            ? "Scheduled"
            : action === "cancel-schedule"
              ? "Schedule canceled"
              : "Unpublished",
      );
      if (data.revalidate && data.revalidate.ok === false) {
        // Publish committed, but the public cache didn't refresh. The
        // 10-minute ISR safety net will catch up; warn so editors don't
        // think the post never went live.
        toast.warning(
          data.revalidate.reason === "config-missing"
            ? "Public cache refresh skipped — webhook secret missing. Ops has been notified."
            : "Public cache refresh failed. The site will catch up within 10 minutes.",
        );
      }
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
    setSaving(true);
    try {
      const res = await fetch(`/api/blog/posts/${postId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res));
      toast.success("Post deleted");
      window.location.replace("/blog");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      setSaving(false);
      setConfirmingDelete(false);
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
                  <Link href={publicUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    {publicUrl}
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
          {postId ? (
            <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
              {autosaving
                ? "Autosaving..."
                : lastSavedAt
                  ? `Saved at ${lastSavedAt.toLocaleTimeString()}`
                  : "Autosave runs every 30 seconds when idle."}
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
              {post?.status === "SCHEDULED" ? (
                <button
                  type="button"
                  onClick={() => void runLifecycle("cancel-schedule")}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
                >
                  <CalendarClock className="h-4 w-4" />
                  Cancel schedule
                </button>
              ) : post?.status === "PUBLISHED" ? null : (
                <button
                  type="button"
                  onClick={() => void runLifecycle("schedule")}
                  disabled={saving || !form.scheduledAt}
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
                >
                  <CalendarClock className="h-4 w-4" />
                  Schedule
                </button>
              )}
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
                onClick={() => setConfirmingDelete(true)}
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
              className="w-full border-0 bg-transparent p-0 text-3xl font-semibold text-foreground outline-none placeholder:text-muted-foreground"
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
          {postId ? (
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
          ) : null}

          {postId ? (
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
          ) : null}

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
              {postId ? (
                <>
                  <CategoryPicker
                    locale={form.locale}
                    value={form.categoryId}
                    onChange={(categoryId) => setForm((f) => ({ ...f, categoryId }))}
                    disabled={saving}
                  />
                  <TagPicker
                    locale={form.locale}
                    value={form.tagIds}
                    onChange={(tagIds) => setForm((f) => ({ ...f, tagIds }))}
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
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Category, tags, excerpt, scheduling, the cover image, and SEO meta unlock once you create the draft.
                </p>
              )}
            </div>
          </section>

          {postId ? (
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
                    placeholder="https://locateflow.com/blog/post"
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
          ) : null}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete blog post"
        description={form.title.trim() ? `"${form.title.trim()}" will be permanently deleted. This cannot be undone.` : "This post will be permanently deleted. This cannot be undone."}
        confirmLabel="Delete post"
        busy={saving}
        onClose={() => { if (!saving) setConfirmingDelete(false); }}
        onConfirm={deletePost}
      />
    </div>
  );
}

/**
 * Admin /blog — list + entry point.
 *
 * Server component reads the requested status / locale / search slice
 * straight from the URL so editors can deep-link to a specific view
 * (e.g. /blog?status=DRAFT&q=move). The actual list is small enough
 * to render server-side without pagination — we cap at 200 rows; once
 * the catalog crosses that we'll layer a cursor in.
 */
export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  PenSquare,
  Plus,
  Eye,
  CalendarClock,
  CheckCircle2,
  Archive,
  Search,
  BarChart3,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

type StatusFilter = "ALL" | "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

const STATUS_TABS: Array<{ key: StatusFilter; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Drafts" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "PUBLISHED", label: "Published" },
  { key: "ARCHIVED", label: "Archived" },
];

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground border-border",
  SCHEDULED: "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-300",
  PUBLISHED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-300",
  ARCHIVED: "bg-foreground/5 text-foreground/60 border-foreground/10",
};

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  DRAFT: PenSquare,
  SCHEDULED: CalendarClock,
  PUBLISHED: CheckCircle2,
  ARCHIVED: Archive,
};

const PUBLIC_WEB_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://locateflow.com").replace(/\/+$/, "");

function publicPostUrl(slug: string, locale: string): string {
  return `${PUBLIC_WEB_URL}/blog/${slug}${locale === "es" ? "?locale=es" : ""}`;
}

function isStatus(value: string | undefined): value is Exclude<StatusFilter, "ALL"> {
  return value === "DRAFT" || value === "SCHEDULED" || value === "PUBLISHED" || value === "ARCHIVED";
}

const PAGE_SIZE = 50;

function buildHref(params: { status?: StatusFilter; locale?: string; q?: string; page?: number }): string {
  const sp = new URLSearchParams();
  if (params.status && params.status !== "ALL") sp.set("status", params.status);
  if (params.locale && params.locale !== "all") sp.set("locale", params.locale);
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/blog?${qs}` : "/blog";
}

export default async function BlogListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; locale?: string; q?: string; page?: string }>;
}) {
  await requirePermission("blog", "canRead", { minimumRole: "MODERATOR" });

  const sp = await searchParams;
  const activeStatus: StatusFilter =
    sp.status && (sp.status === "ALL" || isStatus(sp.status)) ? (sp.status as StatusFilter) : "ALL";
  const activeLocale = sp.locale === "es" || sp.locale === "en" ? sp.locale : "all";
  const query = (sp.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const where: Record<string, unknown> = { deletedAt: null };
  if (isStatus(activeStatus)) where.status = activeStatus;
  if (activeLocale !== "all") where.locale = activeLocale;
  if (query) {
    where.OR = [
      { title: { contains: query } },
      { slug: { contains: query } },
      { excerpt: { contains: query } },
    ];
  }

  // Defensive fetch: if either query throws (mismatched Prisma client,
  // missing migration, RBAC edge case) we still want to render the
  // shell with an actionable message instead of a 500. The error is
  // also logged so it surfaces in server logs / Sentry.
  type PostRow = {
    id: string;
    title: string;
    slug: string;
    locale: string;
    status: string;
    publishedAt: Date | null;
    scheduledAt: Date | null;
    updatedAt: Date;
    viewCount: number;
    author: { firstName: string | null; lastName: string | null } | null;
    category: { name: string } | null;
  };
  let posts: PostRow[] = [];
  let totalMatching = 0;
  let statusCounts: Array<{ status: string; _count: number }> = [];
  let loadError: string | null = null;
  try {
    const [postsResult, totalResult, countsResult] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          locale: true,
          status: true,
          publishedAt: true,
          scheduledAt: true,
          updatedAt: true,
          viewCount: true,
          author: { select: { firstName: true, lastName: true } },
          category: { select: { name: true } },
        },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.blogPost.count({ where }),
      prisma.blogPost.groupBy({
        by: ["status"],
        where: { deletedAt: null },
        _count: true,
      }),
    ]);
    posts = postsResult as PostRow[];
    totalMatching = totalResult ?? 0;
    statusCounts = (countsResult as Array<{ status: string; _count: number }>) ?? [];
  } catch (e) {
    console.error("[admin/blog] list query failed:", e);
    loadError =
      e instanceof Error ? e.message : "The blog catalog couldn't be loaded.";
  }
  const totalPages = Math.max(1, Math.ceil(totalMatching / PAGE_SIZE));

  const countByStatus = new Map<string, number>(
    statusCounts.map((row) => [row.status, row._count]),
  );
  const totalActive = statusCounts.reduce((sum, row) => sum + row._count, 0);
  const tabCount = (key: StatusFilter): number =>
    key === "ALL" ? totalActive : countByStatus.get(key) ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Blog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Drafts, scheduled posts, and published articles. Edits revalidate the public site
            within seconds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/blog/analytics"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground transition hover:bg-accent"
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Link>
          <Link
            href="/blog/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New post
          </Link>
        </div>
      </header>

      {/* Status tabs + filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map((tab) => {
            const isActive = activeStatus === tab.key;
            const count = tabCount(tab.key);
            return (
              <Link
                key={tab.key}
                href={buildHref({ status: tab.key, locale: activeLocale, q: query })}
                className={
                  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition " +
                  (isActive
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground")
                }
              >
                {tab.label}
                <span
                  className={
                    "rounded-full px-1.5 text-[10px] font-mono " +
                    (isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")
                  }
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Locale filter */}
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5 text-xs">
            {(["all", "en", "es"] as const).map((loc) => (
              <Link
                key={loc}
                href={buildHref({ status: activeStatus, locale: loc, q: query })}
                className={
                  "rounded px-2 py-1 transition " +
                  (activeLocale === loc
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground")
                }
              >
                {loc === "all" ? "All locales" : loc.toUpperCase()}
              </Link>
            ))}
          </div>

          <form className="relative" method="get" action="/blog">
            {activeStatus !== "ALL" ? (
              <input type="hidden" name="status" value={activeStatus} />
            ) : null}
            {activeLocale !== "all" ? (
              <input type="hidden" name="locale" value={activeLocale} />
            ) : null}
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search title or slug…"
              className="w-56 rounded-md border border-border bg-background py-1.5 pl-7 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </form>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <p className="text-sm font-medium text-destructive">Couldn&apos;t load the catalog.</p>
          <p className="mt-2 text-xs text-muted-foreground">{loadError}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Most often this means the database is mid-migration or the Prisma client is out of date.
            Run <code className="rounded bg-muted px-1.5 py-0.5">pnpm --filter @locateflow/db generate</code>{" "}
            then redeploy.
          </p>
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 p-12 text-center">
          <p className="text-base font-medium text-foreground">
            {query
              ? "No posts match your search."
              : activeStatus === "ALL"
                ? "No posts yet."
                : `No ${activeStatus.toLowerCase()} posts.`}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {query
              ? "Try a different keyword or clear filters."
              : "Click New post to publish your first article."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {/* Desktop table */}
          <table className="hidden w-full text-sm md:table">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Locale</th>
                <th className="px-4 py-3 font-medium">Author</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium text-right">Views</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {posts.map((p) => {
                const Icon = STATUS_ICON[p.status] ?? PenSquare;
                const dateLabel =
                  p.status === "SCHEDULED" && p.scheduledAt
                    ? `Scheduled ${p.scheduledAt.toISOString().slice(0, 10)}`
                    : p.publishedAt
                      ? p.publishedAt.toISOString().slice(0, 10)
                      : p.updatedAt.toISOString().slice(0, 10);
                return (
                  <tr key={p.id} className="transition hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <Link
                        href={`/blog/${p.id}/edit`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {p.title || "(untitled)"}
                      </Link>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        /{p.slug}
                        {p.category ? <span> · {p.category.name}</span> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                          (STATUS_BADGE[p.status] ?? STATUS_BADGE.DRAFT)
                        }
                      >
                        <Icon className="h-3 w-3" />
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs uppercase text-muted-foreground">{p.locale}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {p.author?.firstName} {p.author?.lastName}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{dateLabel}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                      {(p.viewCount ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {p.status === "PUBLISHED" ? (
                          <a
                            href={publicPostUrl(p.slug, p.locale)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                            aria-label="Open public post"
                          >
                            <Eye className="h-4 w-4" />
                          </a>
                        ) : null}
                        <Link
                          href={`/blog/${p.id}/edit`}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground transition hover:bg-accent"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile card list */}
          <ul className="divide-y divide-border md:hidden">
            {posts.map((p) => {
              const Icon = STATUS_ICON[p.status] ?? PenSquare;
              return (
                <li key={p.id} className="flex flex-col gap-2 p-4">
                  <Link
                    href={`/blog/${p.id}/edit`}
                    className="font-medium text-foreground"
                  >
                    {p.title || "(untitled)"}
                  </Link>
                  <div className="text-xs text-muted-foreground">/{p.slug}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={
                        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium " +
                        (STATUS_BADGE[p.status] ?? STATUS_BADGE.DRAFT)
                      }
                    >
                      <Icon className="h-3 w-3" />
                      {p.status}
                    </span>
                    <span className="uppercase text-muted-foreground">{p.locale}</span>
                    <span className="text-muted-foreground">
                      {(p.viewCount ?? 0).toLocaleString()} views
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {totalPages > 1 ? (
        <nav
          aria-label="Pagination"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground"
        >
          <span>
            Page {page} of {totalPages} · {totalMatching.toLocaleString()} posts
          </span>
          <div className="flex items-center gap-1">
            {page > 1 ? (
              <Link
                href={buildHref({ status: activeStatus, locale: activeLocale, q: query, page: page - 1 })}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-accent"
              >
                Prev
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 opacity-40">
                Prev
              </span>
            )}
            {page < totalPages ? (
              <Link
                href={buildHref({ status: activeStatus, locale: activeLocale, q: query, page: page + 1 })}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-accent"
              >
                Next
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 opacity-40">
                Next
              </span>
            )}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

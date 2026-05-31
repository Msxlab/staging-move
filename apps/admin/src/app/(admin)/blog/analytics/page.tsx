/**
 * Admin /blog/analytics — read-only telemetry dashboard.
 *
 * Three questions every editor asks first:
 *   1. "Which posts are pulling traffic?"
 *   2. "How much of that is humans vs bots vs AI crawlers?"
 *   3. "For this specific post, where are readers coming from?"
 *
 * Pass `?postId=<id>` to drill into a single post's last-30-day
 * performance: daily timeline, locale split, and top referrers.
 *
 * BlogView rows hold the signals we need (`isBot`, `referrer`,
 * `locale`). We aggregate in JS so SQL stays portable across MySQL
 * versions and so a sparse view table keeps the dashboard cheap.
 */
export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin-page-header";

const WINDOW_DAYS = 30;

function shortenReferrer(value: string | null | undefined): string {
  if (!value) return "(direct)";
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, "");
  } catch {
    // Some referrers come in as bare hostnames or protocol-less strings.
    return value.length > 40 ? `${value.slice(0, 37)}...` : value;
  }
}

export default async function BlogAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ postId?: string }>;
}) {
  await requirePermission("blog", "canRead", { minimumRole: "MODERATOR" });

  const sp = (await searchParams) ?? {};
  const postId = sp.postId ?? null;
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Per-post drill-down branch — show a focused view for a single post.
  if (postId) {
    return <PerPostAnalytics postId={postId} since={since} />;
  }

  // Two queries — compact, no joins beyond `post` for titles. We
  // intentionally aggregate in JS so the SQL stays portable across
  // MySQL versions and so a sparse table keeps cost low.
  const [recentViews, totalsByBot] = await Promise.all([
    prisma.blogView.findMany({
      where: { createdAt: { gte: since } },
      select: {
        postId: true,
        isBot: true,
        post: { select: { title: true, slug: true, locale: true } },
      },
      take: 20000,
    }),
    prisma.blogView.groupBy({
      by: ["isBot"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);

  // Top 10 by human views.
  const perPost = new Map<
    string,
    { id: string; title: string; slug: string; locale: string; human: number; bot: number }
  >();
  for (const v of recentViews) {
    const key = v.postId;
    const e = perPost.get(key) ?? {
      id: v.postId,
      title: v.post.title,
      slug: v.post.slug,
      locale: v.post.locale,
      human: 0,
      bot: 0,
    };
    if (v.isBot) e.bot += 1;
    else e.human += 1;
    perPost.set(key, e);
  }
  const topPosts = Array.from(perPost.values())
    .sort((a, b) => b.human - a.human)
    .slice(0, 10);

  const totals = {
    human: totalsByBot.find((t) => !t.isBot)?._count._all ?? 0,
    bot: totalsByBot.find((t) => t.isBot)?._count._all ?? 0,
  };
  const totalAll = totals.human + totals.bot || 1;

  return (
    <div className="p-6 max-w-5xl">
      <AdminPageHeader
        eyebrow="Content"
        title="Blog <em>Analytics</em>"
        subtitle={`Last ${WINDOW_DAYS} days. View counts exclude duplicate visits within the same UTC day from the same hashed IP.`}
      />

      <section className="grid grid-cols-2 gap-4 mb-8">
        <div className="border rounded-md p-4">
          <div className="text-xs uppercase text-muted-foreground">Human views</div>
          <div className="text-3xl font-semibold mt-1">{totals.human.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {Math.round((totals.human / totalAll) * 100)}% of all hits
          </div>
        </div>
        <div className="border rounded-md p-4">
          <div className="text-xs uppercase text-muted-foreground">Bot / AI views</div>
          <div className="text-3xl font-semibold mt-1">{totals.bot.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {Math.round((totals.bot / totalAll) * 100)}% of all hits
          </div>
        </div>
      </section>

      <h2 className="text-lg font-medium mb-3">Top posts (humans)</h2>
      {topPosts.length === 0 ? (
        <div className="border rounded-md p-6 text-sm text-muted-foreground text-center">
          No views recorded yet in this window.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Title</th>
              <th>Locale</th>
              <th>Human</th>
              <th>Bot</th>
            </tr>
          </thead>
          <tbody>
            {topPosts.map((p) => (
              <tr key={`${p.locale}-${p.slug}`} className="border-t">
                <td className="py-2">
                  <Link
                    href={`/blog/analytics?postId=${encodeURIComponent(p.id)}`}
                    className="hover:text-primary hover:underline"
                  >
                    {p.title}
                  </Link>
                  <div className="text-xs text-muted-foreground">/{p.slug}</div>
                </td>
                <td>{p.locale}</td>
                <td>{p.human.toLocaleString()}</td>
                <td className="text-muted-foreground">{p.bot.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

async function PerPostAnalytics({ postId, since }: { postId: string; since: Date }) {
  const post = await prisma.blogPost
    .findFirst({
      where: { id: postId, deletedAt: null },
      select: {
        id: true,
        title: true,
        slug: true,
        locale: true,
        status: true,
        viewCount: true,
        publishedAt: true,
      },
    })
    .catch(() => null);

  if (!post) {
    return (
      <div className="p-6 max-w-3xl space-y-4">
        <Link href="/blog/analytics" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to overview
        </Link>
        <div className="rounded-md border p-6 text-sm text-muted-foreground">Post not found.</div>
      </div>
    );
  }

  const views = await prisma.blogView.findMany({
    where: { postId, createdAt: { gte: since } },
    select: {
      isBot: true,
      locale: true,
      referrer: true,
      createdAt: true,
    },
    take: 20000,
  });

  const totals = { human: 0, bot: 0 };
  const dailyMap = new Map<string, { human: number; bot: number }>();
  const localeMap = new Map<string, number>();
  const referrerMap = new Map<string, number>();
  for (const v of views) {
    if (v.isBot) totals.bot += 1;
    else totals.human += 1;

    const day = v.createdAt.toISOString().slice(0, 10);
    const dailyEntry = dailyMap.get(day) ?? { human: 0, bot: 0 };
    if (v.isBot) dailyEntry.bot += 1;
    else dailyEntry.human += 1;
    dailyMap.set(day, dailyEntry);

    if (!v.isBot) {
      const localeKey = v.locale ?? "—";
      localeMap.set(localeKey, (localeMap.get(localeKey) ?? 0) + 1);
      const refKey = shortenReferrer(v.referrer);
      referrerMap.set(refKey, (referrerMap.get(refKey) ?? 0) + 1);
    }
  }

  const totalAll = totals.human + totals.bot || 1;
  const daily = Array.from(dailyMap.entries())
    .map(([day, counts]) => ({ day, ...counts }))
    .sort((a, b) => a.day.localeCompare(b.day));
  const peak = daily.reduce((max, day) => Math.max(max, day.human), 1);
  const localeRows = Array.from(localeMap.entries())
    .map(([locale, count]) => ({ locale, count }))
    .sort((a, b) => b.count - a.count);
  const referrerRows = Array.from(referrerMap.entries())
    .map(([referrer, count]) => ({ referrer, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <div className="p-6 max-w-5xl">
      <AdminPageHeader
        eyebrow="Content"
        title={post.title}
        actions={
          <>
            <Link href="/blog/analytics" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to overview
            </Link>
          </>
        }
      />
      <p className="mt-1 text-sm text-muted-foreground">
        /{post.slug} · {post.locale.toUpperCase()} · {post.status}
        {post.publishedAt ? ` · published ${post.publishedAt.toISOString().slice(0, 10)}` : ""}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Last {WINDOW_DAYS} days. Lifetime human views: {(post.viewCount ?? 0).toLocaleString()}
      </p>

      <section className="mt-6 grid grid-cols-2 gap-4">
        <div className="border rounded-md p-4">
          <div className="text-xs uppercase text-muted-foreground">Human views (30d)</div>
          <div className="text-3xl font-semibold mt-1">{totals.human.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-1">{Math.round((totals.human / totalAll) * 100)}% of all hits</div>
        </div>
        <div className="border rounded-md p-4">
          <div className="text-xs uppercase text-muted-foreground">Bot / AI views (30d)</div>
          <div className="text-3xl font-semibold mt-1">{totals.bot.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-1">{Math.round((totals.bot / totalAll) * 100)}% of all hits</div>
        </div>
      </section>

      <h2 className="mt-8 text-lg font-medium">Daily timeline</h2>
      {daily.length === 0 ? (
        <div className="mt-3 border rounded-md p-6 text-sm text-muted-foreground text-center">
          No views recorded in this window.
        </div>
      ) : (
        <div className="mt-3 border rounded-md p-4">
          <div className="flex items-end gap-1 h-32">
            {daily.map((day) => {
              const heightPct = Math.max(2, Math.round((day.human / peak) * 100));
              return (
                <div
                  key={day.day}
                  title={`${day.day}: ${day.human} human, ${day.bot} bot`}
                  className="relative flex-1 bg-tone-sage-fg/40 rounded-sm"
                  style={{ height: `${heightPct}%` }}
                />
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground font-mono">
            <span>{daily[0]?.day}</span>
            <span>{daily[daily.length - 1]?.day}</span>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="text-lg font-medium">Top referrers (humans)</h2>
          {referrerRows.length === 0 ? (
            <div className="mt-3 border rounded-md p-6 text-sm text-muted-foreground text-center">No referrers.</div>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Source</th>
                  <th>Visits</th>
                </tr>
              </thead>
              <tbody>
                {referrerRows.map((row) => (
                  <tr key={row.referrer} className="border-t">
                    <td className="py-2 truncate max-w-xs">{row.referrer}</td>
                    <td>{row.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2 className="text-lg font-medium">Locale split (humans)</h2>
          {localeRows.length === 0 ? (
            <div className="mt-3 border rounded-md p-6 text-sm text-muted-foreground text-center">No data.</div>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Locale</th>
                  <th>Visits</th>
                </tr>
              </thead>
              <tbody>
                {localeRows.map((row) => (
                  <tr key={row.locale} className="border-t">
                    <td className="py-2 uppercase">{row.locale}</td>
                    <td>{row.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}


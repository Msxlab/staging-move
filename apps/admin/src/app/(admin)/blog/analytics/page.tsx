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
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Content"
        title="Blog <em>Analytics</em>"
        subtitle={`Last ${WINDOW_DAYS} days. View counts exclude duplicate visits within the same UTC day from the same hashed IP.`}
      />

      <section className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-muted-foreground">Human views</p>
          <p className="mt-2 font-display text-3xl font-extrabold leading-none text-foreground">{totals.human.toLocaleString()}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            <span className="font-mono text-tone-sage-fg">{Math.round((totals.human / totalAll) * 100)}%</span> of all hits
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-muted-foreground">Bot / AI views</p>
          <p className="mt-2 font-display text-3xl font-extrabold leading-none text-foreground">{totals.bot.toLocaleString()}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            <span className="font-mono">{Math.round((totals.bot / totalAll) * 100)}%</span> of all hits
          </p>
        </div>
      </section>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 font-display text-base font-bold text-foreground">Top posts <span className="text-xs font-normal text-muted-foreground">(humans)</span></h2>
        {topPosts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No views recorded yet in this window.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[480px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Title</th>
                  <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Locale</th>
                  <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Human</th>
                  <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Bot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topPosts.map((p) => (
                  <tr key={`${p.locale}-${p.slug}`} className="bg-card transition-colors hover:bg-accent/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/blog/analytics?postId=${encodeURIComponent(p.id)}`}
                        className="text-sm font-medium text-foreground transition-colors hover:text-primary hover:underline"
                      >
                        {p.title}
                      </Link>
                      <div className="font-mono text-xs text-muted-foreground">/{p.slug}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs uppercase text-muted-foreground">{p.locale}</td>
                    <td className="px-4 py-3 font-mono text-sm font-bold text-foreground">{p.human.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-sm text-muted-foreground">{p.bot.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
      <div className="space-y-4">
        <Link href="/blog/analytics" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to overview
        </Link>
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">Post not found.</div>
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
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Content"
        title={post.title}
        actions={
          <>
            <Link href="/blog/analytics" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to overview
            </Link>
          </>
        }
      />

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">
          <span className="font-mono">/{post.slug}</span> · <span className="font-mono uppercase">{post.locale.toUpperCase()}</span> · {post.status}
          {post.publishedAt ? <> · published <span className="font-mono">{post.publishedAt.toISOString().slice(0, 10)}</span></> : ""}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Last {WINDOW_DAYS} days. Lifetime human views: <span className="font-mono text-foreground">{(post.viewCount ?? 0).toLocaleString()}</span>
        </p>
      </div>

      <section className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-muted-foreground">Human views (30d)</p>
          <p className="mt-2 font-display text-3xl font-extrabold leading-none text-foreground">{totals.human.toLocaleString()}</p>
          <p className="mt-1.5 text-xs text-muted-foreground"><span className="font-mono text-tone-sage-fg">{Math.round((totals.human / totalAll) * 100)}%</span> of all hits</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-muted-foreground">Bot / AI views (30d)</p>
          <p className="mt-2 font-display text-3xl font-extrabold leading-none text-foreground">{totals.bot.toLocaleString()}</p>
          <p className="mt-1.5 text-xs text-muted-foreground"><span className="font-mono">{Math.round((totals.bot / totalAll) * 100)}%</span> of all hits</p>
        </div>
      </section>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 font-display text-base font-bold text-foreground">Daily timeline</h2>
        {daily.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No views recorded in this window.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-end gap-1 h-32">
              {daily.map((day) => {
                const heightPct = Math.max(2, Math.round((day.human / peak) * 100));
                return (
                  <div
                    key={day.day}
                    title={`${day.day}: ${day.human} human, ${day.bot} bot`}
                    className="relative flex-1 rounded-sm bg-tone-sage-fg/50"
                    style={{ height: `${heightPct}%` }}
                  />
                );
              })}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>{daily[0]?.day}</span>
              <span>{daily[daily.length - 1]?.day}</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-display text-base font-bold text-foreground">Top referrers <span className="text-xs font-normal text-muted-foreground">(humans)</span></h2>
          {referrerRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No referrers.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Source</th>
                    <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Visits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {referrerRows.map((row) => (
                    <tr key={row.referrer} className="bg-card transition-colors hover:bg-accent/30">
                      <td className="max-w-xs truncate px-4 py-3 text-sm text-foreground">{row.referrer}</td>
                      <td className="px-4 py-3 font-mono text-sm text-muted-foreground">{row.count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-display text-base font-bold text-foreground">Locale split <span className="text-xs font-normal text-muted-foreground">(humans)</span></h2>
          {localeRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No data.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Locale</th>
                    <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Visits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {localeRows.map((row) => (
                    <tr key={row.locale} className="bg-card transition-colors hover:bg-accent/30">
                      <td className="px-4 py-3 font-mono text-sm uppercase text-foreground">{row.locale}</td>
                      <td className="px-4 py-3 font-mono text-sm text-muted-foreground">{row.count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/**
 * Admin /blog/analytics — read-only telemetry dashboard.
 *
 * Two questions every editor asks first:
 *   1. "Which posts are pulling traffic?"
 *   2. "How much of that is humans vs bots vs AI crawlers?"
 *
 * BlogView rows hold both signals (`isBot`, plus the UA when we want
 * to drill in). We compute the two summaries server-side here so the
 * page is one round-trip; pagination/filtering can come later.
 */
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

const WINDOW_DAYS = 30;

export default async function BlogAnalyticsPage() {
  await requirePermission("blog", "canRead", { minimumRole: "MODERATOR" });

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

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
    { title: string; slug: string; locale: string; human: number; bot: number }
  >();
  for (const v of recentViews) {
    const key = v.postId;
    const e = perPost.get(key) ?? {
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
      <h1 className="text-2xl font-semibold mb-2">Blog analytics</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Last {WINDOW_DAYS} days. View counts exclude duplicate visits within
        the same UTC day from the same hashed IP.
      </p>

      <section className="grid grid-cols-2 gap-4 mb-8">
        <div className="border rounded-md p-4">
          <div className="text-xs uppercase text-zinc-500">Human views</div>
          <div className="text-3xl font-semibold mt-1">{totals.human.toLocaleString()}</div>
          <div className="text-xs text-zinc-500 mt-1">
            {Math.round((totals.human / totalAll) * 100)}% of all hits
          </div>
        </div>
        <div className="border rounded-md p-4">
          <div className="text-xs uppercase text-zinc-500">Bot / AI views</div>
          <div className="text-3xl font-semibold mt-1">{totals.bot.toLocaleString()}</div>
          <div className="text-xs text-zinc-500 mt-1">
            {Math.round((totals.bot / totalAll) * 100)}% of all hits
          </div>
        </div>
      </section>

      <h2 className="text-lg font-medium mb-3">Top posts (humans)</h2>
      {topPosts.length === 0 ? (
        <div className="border rounded-md p-6 text-sm text-zinc-500 text-center">
          No views recorded yet in this window.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-zinc-500">
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
                  {p.title}
                  <div className="text-xs text-zinc-500">/{p.slug}</div>
                </td>
                <td>{p.locale}</td>
                <td>{p.human.toLocaleString()}</td>
                <td className="text-zinc-500">{p.bot.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

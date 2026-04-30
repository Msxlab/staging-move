import Link from "next/link";
import Image from "next/image";
import { getLocale } from "next-intl/server";
import { isBlogLocale } from "@locateflow/shared";
import { listPublicPosts } from "@/lib/blog/queries";
import { blogPostPath } from "@/lib/blog/urls";

/**
 * Homepage "Latest" strip — three most recent published posts. Server
 * component; benefits from the same ISR window the /blog list uses
 * (publish webhook revalidates `/`). Renders nothing if there are no
 * posts so an empty blog doesn't push a sad ghost section onto a
 * marketing page.
 */
export async function LatestBlogPosts() {
  let listing;
  try {
    const locale = await getLocale();
    listing = await listPublicPosts({
      locale: isBlogLocale(locale) ? locale : undefined,
      pageSize: 3,
    });
    if (listing.items.length === 0 && locale !== "en") {
      listing = await listPublicPosts({ locale: "en", pageSize: 3 });
    }
  } catch {
    return null;
  }
  if (listing.items.length === 0) return null;

  return (
    <section className="py-16 border-t" aria-labelledby="latest-blog-heading">
      <div className="container">
        <div className="mb-8 flex items-end justify-between">
          <h2 id="latest-blog-heading" className="text-3xl font-semibold tracking-tight">
            From the blog
          </h2>
          <Link
            href="/blog"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            View all →
          </Link>
        </div>
        <ul className="grid gap-8 md:grid-cols-3">
          {listing.items.map((p) => (
            <li key={`${p.locale}-${p.slug}`}>
              <Link href={blogPostPath(p.slug, p.locale)} className="group block">
                {p.ogImageUrl ? (
                  <div className="aspect-[1200/630] relative overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    <Image
                      src={p.ogImageUrl}
                      alt={p.title}
                      fill
                      sizes="(min-width: 768px) 33vw, 100vw"
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="aspect-[1200/630] rounded-lg bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900" />
                )}
                <h3 className="mt-3 text-lg font-medium tracking-tight group-hover:underline">
                  {p.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{p.excerpt}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  {new Date(p.publishedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  · {p.readingMinutes} min
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

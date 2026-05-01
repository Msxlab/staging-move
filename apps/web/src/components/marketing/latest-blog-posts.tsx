import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { getLocale } from "next-intl/server";
import { isBlogLocale } from "@locateflow/shared";
import { listPublicPosts } from "@/lib/blog/queries";
import { blogPostPath } from "@/lib/blog/urls";

/**
 * Homepage "Latest" strip — three most recent published posts. Server
 * component; benefits from the same ISR window the /blog list uses
 * (publish webhook revalidates `/`). Renders nothing if there are no
 * posts so an empty blog doesn't push a sad ghost section onto a
 * marketing page. Visual language matches the new magazine-style blog.
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
    <section className="border-t py-20" aria-labelledby="latest-blog-heading">
      <div className="container">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
              The Field Guide
            </span>
            <h2
              id="latest-blog-heading"
              className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              From the blog
            </h2>
          </div>
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition hover:text-primary"
          >
            All stories
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <ul className="grid gap-x-8 gap-y-12 md:grid-cols-3">
          {listing.items.map((p) => (
            <li key={`${p.locale}-${p.slug}`}>
              <Link href={blogPostPath(p.slug, p.locale)} className="group block">
                <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border bg-card/40">
                  {p.ogImageUrl ? (
                    <Image
                      src={p.ogImageUrl}
                      alt={p.title}
                      fill
                      sizes="(min-width: 768px) 33vw, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,hsl(var(--primary)/0.15),transparent_60%)]"
                    />
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {p.category ? p.category.name : "Field Notes"} · {p.readingMinutes} min
                  </div>
                  <h3 className="font-display text-xl font-semibold leading-tight tracking-tight transition group-hover:text-primary">
                    {p.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">
                    {p.excerpt}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.publishedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

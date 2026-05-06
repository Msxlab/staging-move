"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  HelpCircle,
  MessageCircle,
  Search,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import type { HelpArticle, HelpFaq } from "@/lib/help-content";
import { cn } from "@/lib/utils";

type HelpCenterContentProps = {
  articles: HelpArticle[];
  faqs: HelpFaq[];
  showHeading?: boolean;
};

function includesQuery(value: string | null | undefined, query: string) {
  return (value || "").toLowerCase().includes(query);
}

function uniqueCategories<T extends { category: string }>(items: T[]) {
  return Array.from(new Set(items.map((item) => item.category)));
}

export function HelpCenterContent({
  articles,
  faqs,
  showHeading = true,
}: HelpCenterContentProps) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();

  const filteredArticles = useMemo(
    () =>
      articles.filter((article) => {
        if (!query) return true;
        return (
          includesQuery(article.title, query) ||
          includesQuery(article.excerpt, query) ||
          includesQuery(article.category, query) ||
          includesQuery(article.content, query) ||
          includesQuery(article.tags, query)
        );
      }),
    [articles, query],
  );

  const filteredFaqs = useMemo(
    () =>
      faqs.filter((faq) => {
        if (!query) return true;
        return (
          includesQuery(faq.question, query) ||
          includesQuery(faq.answer, query) ||
          includesQuery(faq.category, query)
        );
      }),
    [faqs, query],
  );

  const articleCategories = uniqueCategories(filteredArticles);
  const faqCategories = uniqueCategories(filteredFaqs);
  const hasResults = filteredArticles.length > 0 || filteredFaqs.length > 0;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-7">
      {showHeading ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10">
            <HelpCircle className="h-7 w-7 text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Help Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Find answers and guides for using LocateFlow
          </p>
        </div>
      ) : null}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search articles and FAQs..."
          className="w-full rounded-xl border border-border bg-foreground/5 py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-foreground/40 transition focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          aria-label="Search help articles and FAQs"
        />
      </div>

      {!hasResults ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold text-foreground">No matching help content</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different keyword or browse all articles and FAQs.
          </p>
        </div>
      ) : null}

      {filteredArticles.length > 0 ? (
        <section className="space-y-4" aria-labelledby="help-articles-heading">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-orange-400" />
            <h2 id="help-articles-heading" className="text-lg font-semibold text-foreground">
              Articles
            </h2>
          </div>
          <div className="space-y-6">
            {articleCategories.map((category) => {
              const categoryArticles = filteredArticles.filter((article) => article.category === category);
              return (
                <div key={category} className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">{category}</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {categoryArticles.map((article) => (
                      <details
                        key={article.id}
                        className="group rounded-xl border border-foreground/[0.08] bg-card/80 p-4 shadow-sm transition hover:border-orange-500/25"
                      >
                        <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                          <span>
                            <span className="block text-sm font-semibold text-foreground">{article.title}</span>
                            {article.excerpt ? (
                              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                                {article.excerpt}
                              </span>
                            ) : null}
                          </span>
                          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-foreground/35 transition group-open:rotate-180" />
                        </summary>
                        <div className="mt-4 border-t border-border pt-4">
                          <article className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                            {article.content}
                          </article>
                          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
                            <span>Was this helpful?</span>
                            <span className="inline-flex items-center gap-1">
                              <ThumbsUp className="h-3.5 w-3.5 text-emerald-400" />
                              Yes ({article.helpfulYes})
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <ThumbsDown className="h-3.5 w-3.5 text-red-400" />
                              No ({article.helpfulNo})
                            </span>
                            <span className={cn("ml-auto", article.viewCount === 0 && "sr-only")}>
                              {article.viewCount} views
                            </span>
                          </div>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {filteredFaqs.length > 0 ? (
        <section className="space-y-4" aria-labelledby="help-faq-heading">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-orange-400" />
            <h2 id="help-faq-heading" className="text-lg font-semibold text-foreground">
              FAQ
            </h2>
          </div>
          <div className="space-y-5">
            {faqCategories.map((category) => {
              const categoryFaqs = filteredFaqs.filter((faq) => faq.category === category);
              return (
                <div key={category} className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">{category}</h3>
                  {categoryFaqs.map((faq) => (
                    <details
                      key={faq.id}
                      className="group rounded-xl border border-foreground/[0.08] bg-card/80 shadow-sm"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left">
                        <span className="text-sm font-semibold text-foreground">{faq.question}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-foreground/35 transition group-open:rotate-180" />
                      </summary>
                      <div className="border-t border-border px-4 py-3 text-sm leading-7 text-muted-foreground">
                        {faq.answer}
                      </div>
                    </details>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

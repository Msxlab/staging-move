"use client";

import { type ReactNode, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  HelpCircle,
  MessageCircle,
  Search,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useLocale } from "next-intl";
import type { HelpArticle, HelpFaq } from "@/lib/help-content";
import { cn } from "@/lib/utils";

type HelpCenterContentProps = {
  articles: HelpArticle[];
  faqs: HelpFaq[];
  showHeading?: boolean;
};

type FeedbackVote = "yes" | "no";

type FeedbackState = {
  yes: number;
  no: number;
  vote?: FeedbackVote;
  pending?: boolean;
  error?: boolean;
};

const HELP_COPY = {
  en: {
    title: "Help Center",
    subtitle: "Find answers and guides for using LocateFlow",
    searchPlaceholder: "Search articles and FAQs...",
    searchLabel: "Search help articles and FAQs",
    noResultsTitle: "No matching help content",
    noResultsBody: "Try a different keyword or browse all articles and FAQs.",
    articles: "Articles",
    faq: "FAQ",
    helpful: "Was this helpful?",
    yes: "Yes",
    no: "No",
    thanks: "Thanks for the feedback.",
    feedbackError: "Could not save feedback.",
    views: "views",
  },
  es: {
    title: "Centro de ayuda",
    subtitle: "Encuentra respuestas y guias para usar LocateFlow",
    searchPlaceholder: "Buscar articulos y preguntas...",
    searchLabel: "Buscar articulos de ayuda y preguntas frecuentes",
    noResultsTitle: "No hay contenido coincidente",
    noResultsBody: "Prueba otra palabra o revisa todos los articulos y preguntas.",
    articles: "Articulos",
    faq: "Preguntas frecuentes",
    helpful: "Te resulto util?",
    yes: "Si",
    no: "No",
    thanks: "Gracias por tu comentario.",
    feedbackError: "No se pudo guardar.",
    views: "vistas",
  },
} as const;

function includesQuery(value: string | null | undefined, query: string) {
  return (value || "").toLowerCase().includes(query);
}

function uniqueCategories<T extends { category: string }>(items: T[]) {
  return Array.from(new Set(items.map((item) => item.category)));
}

function copyForLocale(locale: string) {
  return locale.toLowerCase().startsWith("es") ? HELP_COPY.es : HELP_COPY.en;
}

function safeLinkHref(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? value : null;
  } catch {
    return null;
  }
}

function renderInlineMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).map((part, index) => {
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded-md bg-foreground/10 px-1.5 py-0.5 text-[0.85em] text-foreground">
          {part.slice(1, -1)}
        </code>
      );
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = safeLinkHref(link[2]);
      if (href) {
        return (
          <a key={index} href={href} className="font-medium text-primary underline-offset-4 hover:underline">
            {link[1]}
          </a>
        );
      }
      return link[1];
    }
    return part;
  });
}

function renderMarkdownBlocks(content: string) {
  const nodes: ReactNode[] = [];
  let unorderedItems: string[] = [];
  let orderedItems: string[] = [];

  const flushLists = () => {
    if (unorderedItems.length > 0) {
      const items = unorderedItems;
      unorderedItems = [];
      nodes.push(
        <ul key={`ul-${nodes.length}`} className="my-3 list-disc space-y-1 pl-5">
          {items.map((item, index) => (
            <li key={index}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>,
      );
    }
    if (orderedItems.length > 0) {
      const items = orderedItems;
      orderedItems = [];
      nodes.push(
        <ol key={`ol-${nodes.length}`} className="my-3 list-decimal space-y-1 pl-5">
          {items.map((item, index) => (
            <li key={index}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>,
      );
    }
  };

  content.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushLists();
      return;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushLists();
      const HeadingTag = heading[1].length === 1 ? "h2" : "h3";
      nodes.push(
        <HeadingTag key={`heading-${nodes.length}`} className="mt-4 text-sm font-semibold text-foreground">
          {renderInlineMarkdown(heading[2])}
        </HeadingTag>,
      );
      return;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      orderedItems = [];
      unorderedItems.push(unordered[1]);
      return;
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      unorderedItems = [];
      orderedItems.push(ordered[1]);
      return;
    }

    flushLists();
    nodes.push(
      <p key={`p-${nodes.length}`} className="my-2">
        {renderInlineMarkdown(line)}
      </p>,
    );
  });

  flushLists();
  return nodes;
}

export function HelpCenterContent({
  articles,
  faqs,
  showHeading = true,
}: HelpCenterContentProps) {
  const locale = useLocale();
  const copy = copyForLocale(locale);
  const [search, setSearch] = useState("");
  const [openArticleIds, setOpenArticleIds] = useState<Set<string>>(new Set());
  const [openFaqIds, setOpenFaqIds] = useState<Set<string>>(new Set());
  const [feedbackByArticle, setFeedbackByArticle] = useState<Record<string, FeedbackState>>({});
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

  const getFeedback = (article: HelpArticle): FeedbackState =>
    feedbackByArticle[article.id] ?? {
      yes: article.helpfulYes,
      no: article.helpfulNo,
    };

  const toggleArticle = (articleId: string) => {
    setOpenArticleIds((previous) => {
      const next = new Set(previous);
      if (next.has(articleId)) next.delete(articleId);
      else next.add(articleId);
      return next;
    });
  };

  const toggleFaq = (faqId: string) => {
    setOpenFaqIds((previous) => {
      const next = new Set(previous);
      if (next.has(faqId)) next.delete(faqId);
      else next.add(faqId);
      return next;
    });
  };

  const submitFeedback = async (article: HelpArticle, vote: FeedbackVote) => {
    const current = getFeedback(article);
    if (current.pending || current.vote) return;

    const optimistic: FeedbackState = {
      yes: current.yes + (vote === "yes" ? 1 : 0),
      no: current.no + (vote === "no" ? 1 : 0),
      vote,
      pending: true,
    };

    setFeedbackByArticle((previous) => ({ ...previous, [article.id]: optimistic }));

    try {
      const response = await fetch("/api/help/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: article.id, vote }),
      });

      if (!response.ok) throw new Error("Could not save feedback.");
      const data = (await response.json()) as { helpfulYes?: number; helpfulNo?: number };
      setFeedbackByArticle((previous) => ({
        ...previous,
        [article.id]: {
          yes: typeof data.helpfulYes === "number" ? data.helpfulYes : optimistic.yes,
          no: typeof data.helpfulNo === "number" ? data.helpfulNo : optimistic.no,
          vote,
          pending: false,
        },
      }));
    } catch {
      setFeedbackByArticle((previous) => ({
        ...previous,
        [article.id]: {
          yes: current.yes,
          no: current.no,
          pending: false,
          error: true,
        },
      }));
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-7">
      {showHeading ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-tone-orange-bg">
            <HelpCircle className="h-7 w-7 text-tone-orange-fg" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{copy.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>
      ) : null}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={copy.searchPlaceholder}
          className="w-full rounded-xl border border-border bg-foreground/5 py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-foreground/40 transition focus:outline-none focus:ring-2 focus:ring-primary/50"
          aria-label={copy.searchLabel}
        />
      </div>

      {!hasResults ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold text-foreground">{copy.noResultsTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{copy.noResultsBody}</p>
        </div>
      ) : null}

      {filteredArticles.length > 0 ? (
        <section className="space-y-4" aria-labelledby="help-articles-heading">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-tone-orange-fg" />
            <h2 id="help-articles-heading" className="text-lg font-semibold text-foreground">
              {copy.articles}
            </h2>
          </div>
          <div className="space-y-6">
            {articleCategories.map((category) => {
              const categoryArticles = filteredArticles.filter((article) => article.category === category);
              return (
                <div key={category} className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">{category}</h3>
                  <div className="columns-1 gap-3 sm:columns-2">
                    {categoryArticles.map((article) => {
                      const feedback = getFeedback(article);
                      const isOpen = openArticleIds.has(article.id);
                      return (
                        <div
                          key={article.id}
                          className="group mb-3 break-inside-avoid rounded-xl border border-foreground/[0.08] bg-card/80 p-4 shadow-sm transition hover:border-tone-orange-br"
                        >
                          <button
                            type="button"
                            onClick={() => toggleArticle(article.id)}
                            className="flex w-full items-start justify-between gap-3 text-left"
                            aria-expanded={isOpen}
                          >
                            <span>
                              <span className="block text-sm font-semibold text-foreground">{article.title}</span>
                              {article.excerpt ? (
                                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                                  {article.excerpt}
                                </span>
                              ) : null}
                            </span>
                            <ChevronDown
                              className={cn(
                                "mt-0.5 h-4 w-4 shrink-0 text-foreground/35 transition",
                                isOpen && "rotate-180",
                              )}
                            />
                          </button>
                          {isOpen ? (
                            <div className="mt-4 border-t border-border pt-4">
                              <article className="text-sm leading-7 text-muted-foreground">
                                {renderMarkdownBlocks(article.content)}
                              </article>
                              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
                                <span className="mr-1">{copy.helpful}</span>
                                <button
                                  type="button"
                                  onClick={() => submitFeedback(article, "yes")}
                                  disabled={feedback.pending || Boolean(feedback.vote)}
                                  aria-pressed={feedback.vote === "yes"}
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 transition",
                                    feedback.vote === "yes"
                                      ? "border-tone-emerald-br bg-tone-emerald-bg text-tone-emerald-fg"
                                      : "hover:border-tone-emerald-br hover:bg-tone-emerald-bg hover:text-tone-emerald-fg",
                                    (feedback.pending || feedback.vote) && "cursor-default",
                                  )}
                                >
                                  <ThumbsUp className="h-3.5 w-3.5" />
                                  {copy.yes} ({feedback.yes})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => submitFeedback(article, "no")}
                                  disabled={feedback.pending || Boolean(feedback.vote)}
                                  aria-pressed={feedback.vote === "no"}
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 transition",
                                    feedback.vote === "no"
                                      ? "border-destructive/25 bg-destructive/10 text-destructive"
                                      : "hover:border-destructive/25 hover:bg-destructive/10 hover:text-destructive",
                                    (feedback.pending || feedback.vote) && "cursor-default",
                                  )}
                                >
                                  <ThumbsDown className="h-3.5 w-3.5" />
                                  {copy.no} ({feedback.no})
                                </button>
                                {feedback.vote && !feedback.pending ? (
                                  <span className="text-foreground/45">{copy.thanks}</span>
                                ) : null}
                                {feedback.error ? <span className="text-destructive">{copy.feedbackError}</span> : null}
                                <span className={cn("ml-auto", article.viewCount === 0 && "sr-only")}>
                                  {article.viewCount} {copy.views}
                                </span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
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
            <MessageCircle className="h-4 w-4 text-tone-orange-fg" />
            <h2 id="help-faq-heading" className="text-lg font-semibold text-foreground">
              {copy.faq}
            </h2>
          </div>
          <div className="space-y-5">
            {faqCategories.map((category) => {
              const categoryFaqs = filteredFaqs.filter((faq) => faq.category === category);
              return (
                <div key={category} className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">{category}</h3>
                  {categoryFaqs.map((faq) => {
                    const isOpen = openFaqIds.has(faq.id);
                    return (
                      <div
                        key={faq.id}
                        className="rounded-xl border border-foreground/[0.08] bg-card/80 shadow-sm"
                      >
                        <button
                          type="button"
                          onClick={() => toggleFaq(faq.id)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                          aria-expanded={isOpen}
                        >
                          <span className="text-sm font-semibold text-foreground">{faq.question}</span>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 text-foreground/35 transition",
                              isOpen && "rotate-180",
                            )}
                          />
                        </button>
                        {isOpen ? (
                          <div className="border-t border-border px-4 py-3 text-sm leading-7 text-muted-foreground">
                            {faq.answer}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

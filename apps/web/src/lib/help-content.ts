import { prisma } from "@/lib/db";
import {
  FALLBACK_FAQS,
  FALLBACK_FAQS_ES,
  FALLBACK_HELP_ARTICLES,
  FALLBACK_HELP_ARTICLES_ES,
} from "@/lib/help-fallback";

export interface HelpArticle {
  id: string;
  slug: string;
  title: string;
  content: string;
  excerpt: string | null;
  category: string;
  tags: string;
  viewCount: number;
  helpfulYes: number;
  helpfulNo: number;
  updatedAt?: Date | string | null;
}

export interface HelpFaq {
  id: string;
  question: string;
  answer: string;
  category: string;
  updatedAt?: Date | string | null;
}

export interface HelpContent {
  articles: HelpArticle[];
  faqs: HelpFaq[];
  fallback: boolean;
}

const blockedArticleSlugs = new Set(["family-sharing"]);
const staleFutureScopePattern =
  /(Family Sharing|\bPro\b|Enterprise|300\+|community access|money-back guarantee|API access|regular security audits|all personal data is deleted immediately|permanently removed within 30 days|comply with applicable privacy laws)/i;

function currentProductArticles<T extends { slug: string; title: string; excerpt: string | null; content: string }>(articles: T[]): T[] {
  return articles.filter((article) => {
    if (blockedArticleSlugs.has(article.slug)) return false;
    return !staleFutureScopePattern.test(`${article.title} ${article.excerpt || ""} ${article.content}`);
  });
}

function currentProductFaqs<T extends { question: string; answer: string }>(faqs: T[]): T[] {
  return faqs.filter((faq) => !staleFutureScopePattern.test(`${faq.question} ${faq.answer}`));
}

function fallbackContent(locale?: string) {
  const isSpanish = locale?.toLowerCase().startsWith("es");
  return {
    articles: isSpanish ? FALLBACK_HELP_ARTICLES_ES : FALLBACK_HELP_ARTICLES,
    faqs: isSpanish ? FALLBACK_FAQS_ES : FALLBACK_FAQS,
  };
}

export async function getHelpContent(locale?: string): Promise<HelpContent> {
  const fallback = fallbackContent(locale);

  // HelpArticle/FAQ records do not have a locale column yet. Until the CMS is
  // locale-aware, Spanish pages should use curated Spanish copy instead of
  // showing English CMS records inside a Spanish shell.
  if (locale?.toLowerCase().startsWith("es")) {
    return {
      articles: fallback.articles,
      faqs: fallback.faqs,
      fallback: true,
    };
  }

  try {
    const [articles, faqs] = await Promise.all([
      prisma.helpArticle.findMany({
        where: { isPublished: true },
        select: {
          id: true,
          slug: true,
          title: true,
          content: true,
          excerpt: true,
          category: true,
          tags: true,
          viewCount: true,
          helpfulYes: true,
          helpfulNo: true,
          updatedAt: true,
        },
        orderBy: [{ category: "asc" }, { order: "asc" }],
      }),
      prisma.fAQ.findMany({
        where: { isPublished: true },
        select: {
          id: true,
          question: true,
          answer: true,
          category: true,
          updatedAt: true,
        },
        orderBy: [{ category: "asc" }, { order: "asc" }],
      }),
    ]);
    const safeArticles = currentProductArticles(articles);
    const safeFaqs = currentProductFaqs(faqs);

    return {
      articles: safeArticles.length > 0 ? safeArticles : fallback.articles,
      faqs: safeFaqs.length > 0 ? safeFaqs : fallback.faqs,
      fallback: safeArticles.length === 0 || safeFaqs.length === 0,
    };
  } catch {
    return {
      articles: fallback.articles,
      faqs: fallback.faqs,
      fallback: true,
    };
  }
}

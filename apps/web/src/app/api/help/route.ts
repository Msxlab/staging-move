import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { FALLBACK_FAQS, FALLBACK_HELP_ARTICLES } from "@/lib/help-fallback";

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

export async function GET() {
  try {
    const [articles, faqs] = await Promise.all([
      prisma.helpArticle.findMany({ where: { isPublished: true }, orderBy: [{ category: "asc" }, { order: "asc" }] }),
      prisma.fAQ.findMany({ where: { isPublished: true }, orderBy: [{ category: "asc" }, { order: "asc" }] }),
    ]);
    const safeArticles = currentProductArticles(articles);
    const safeFaqs = currentProductFaqs(faqs);
    return NextResponse.json({
      articles: safeArticles.length > 0 ? safeArticles : FALLBACK_HELP_ARTICLES,
      faqs: safeFaqs.length > 0 ? safeFaqs : FALLBACK_FAQS,
      fallback: safeArticles.length === 0 || safeFaqs.length === 0,
    });
  } catch {
    return NextResponse.json({ articles: FALLBACK_HELP_ARTICLES, faqs: FALLBACK_FAQS, fallback: true });
  }
}

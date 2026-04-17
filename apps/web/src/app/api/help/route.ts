import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const [articles, faqs] = await Promise.all([
      prisma.helpArticle.findMany({ where: { isPublished: true }, orderBy: [{ category: "asc" }, { order: "asc" }] }),
      prisma.fAQ.findMany({ where: { isPublished: true }, orderBy: [{ category: "asc" }, { order: "asc" }] }),
    ]);
    return NextResponse.json({ articles, faqs });
  } catch {
    return NextResponse.json({ articles: [], faqs: [] });
  }
}

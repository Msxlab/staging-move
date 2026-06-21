import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rl = await rateLimit(getRateLimitKey(request, "help-feedback"), {
    limit: 20,
    windowSeconds: 10 * 60,
    failClosed: "if-redis-configured",
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": Math.ceil((rl.resetAt - Date.now()) / 1000).toString() } },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const body = payload as { articleId?: unknown; vote?: unknown };
  const articleId = typeof body.articleId === "string" ? body.articleId.trim() : "";
  const vote = body.vote === "yes" || body.vote === "no" ? body.vote : null;

  if (!articleId || !vote) {
    return NextResponse.json({ error: "Article and vote are required." }, { status: 400 });
  }

  if (articleId.startsWith("fallback-")) {
    return NextResponse.json({ ok: true, fallback: true });
  }

  try {
    const article = await prisma.helpArticle.update({
      where: { id: articleId },
      data: vote === "yes" ? { helpfulYes: { increment: 1 } } : { helpfulNo: { increment: 1 } },
      select: { helpfulYes: true, helpfulNo: true },
    });

    return NextResponse.json({
      ok: true,
      helpfulYes: article.helpfulYes,
      helpfulNo: article.helpfulNo,
    });
  } catch {
    return NextResponse.json({ error: "Could not save feedback." }, { status: 500 });
  }
}

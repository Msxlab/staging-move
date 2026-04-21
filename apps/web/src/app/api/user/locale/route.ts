import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  isLocale,
} from "@/i18n/config";

export const runtime = "nodejs";

/**
 * Persist the caller's UI language preference.
 *
 * Called from the <LanguageSelector /> client component. Behavior:
 *
 *   - Anonymous caller: updates the `NEXT_LOCALE` cookie only.
 *   - Logged-in caller: updates `User.preferredLocale` in the DB AND
 *     refreshes the cookie so both sources stay in sync within the
 *     same response. On next request, `getRequestConfig()` reads the
 *     cookie; middleware hydrates the cookie from the DB on cold-start
 *     sessions (e.g. new device login).
 *
 * The cookie is not `httpOnly` because the client needs to read it to
 * pre-render the UI before the first round trip. It IS `sameSite:lax`
 * and `secure` in production.
 */

const bodySchema = z.object({
  locale: z.string().min(2).max(10),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success || !isLocale(parsed.data.locale)) {
    return NextResponse.json(
      { error: "Unsupported locale" },
      { status: 400 },
    );
  }
  const locale = parsed.data.locale;

  const session = await getUserSession().catch(() => null);
  if (session?.userId) {
    await prisma.user
      .update({
        where: { id: session.userId },
        data: { preferredLocale: locale },
      })
      .catch(() => null);
  }

  const response = NextResponse.json({ success: true, locale });
  response.cookies.set(LOCALE_COOKIE, locale, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: "/",
  });
  return response;
}

export async function GET() {
  const session = await getUserSession().catch(() => null);
  if (!session?.userId) {
    return NextResponse.json({ locale: null });
  }
  const user = await prisma.user
    .findUnique({
      where: { id: session.userId },
      select: { preferredLocale: true },
    })
    .catch(() => null);
  return NextResponse.json({ locale: user?.preferredLocale ?? null });
}

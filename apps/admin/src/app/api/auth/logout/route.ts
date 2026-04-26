import { NextRequest, NextResponse } from "next/server";
import { destroySession, expireAdminSessionCookies } from "@/lib/auth";

export async function POST(request: NextRequest) {
  await destroySession();
  const response = NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  return expireAdminSessionCookies(response, request.headers.get("host"));
}

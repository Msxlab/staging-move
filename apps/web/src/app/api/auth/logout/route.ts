import { NextRequest, NextResponse } from "next/server";
import { destroyUserSession, expireUserSessionCookies } from "@/lib/user-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await destroyUserSession();
  const response = NextResponse.json(
    { success: true },
    {
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
  return expireUserSessionCookies(response, request.headers.get("host"));
}

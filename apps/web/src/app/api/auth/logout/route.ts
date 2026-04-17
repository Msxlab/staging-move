import { NextResponse } from "next/server";
import { destroyUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

export async function POST() {
  await destroyUserSession();
  return NextResponse.json({ success: true });
}

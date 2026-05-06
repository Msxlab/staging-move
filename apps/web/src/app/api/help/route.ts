import { NextResponse } from "next/server";
import { getHelpContent } from "@/lib/help-content";

export async function GET() {
  const content = await getHelpContent();
  return NextResponse.json(content);
}

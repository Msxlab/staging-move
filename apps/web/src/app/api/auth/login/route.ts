import { NextRequest } from "next/server";
import { handlePasswordLogin } from "@/lib/password-login";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handlePasswordLogin(request, { clientType: "web", exposeBearerToken: false });
}

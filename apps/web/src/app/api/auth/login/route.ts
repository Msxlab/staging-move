import { NextRequest } from "next/server";
import { handlePasswordLogin } from "@/lib/password-login";

export const runtime = "nodejs";

// The web login route delegates to the shared password-login handler so
// browser and mobile share the exact lockout / MFA / audit behaviour.
// Web does not receive the bearer token in the JSON body — the session
// cookie set by createUserSession is the only credential sent back.
export async function POST(request: NextRequest) {
  return handlePasswordLogin(request, { clientType: "web", exposeBearerToken: false });
}

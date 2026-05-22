import type { AuthUser } from "@/lib/auth-store";

export type PostAuthMobileRoute = "/setup-password" | "/onboarding";

export function getPostAuthMobileRoute(
  user: Pick<AuthUser, "needsPasswordSetup"> | null | undefined,
): PostAuthMobileRoute {
  return user?.needsPasswordSetup === true ? "/setup-password" : "/onboarding";
}

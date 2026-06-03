import type { AuthUser } from "@/lib/auth-store";

export type PostAuthMobileRoute = "/onboarding";

export function getPostAuthMobileRoute(
  user: Pick<AuthUser, "needsPasswordSetup"> | null | undefined,
): PostAuthMobileRoute {
  void user;
  return "/onboarding";
}

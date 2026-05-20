export type OAuthProviderId = "google" | "apple";

export interface OAuthProviderStatus {
  configured: boolean;
  label: string;
  message: string;
}

export type OAuthProviderStatusMap = Record<string, OAuthProviderStatus>;

export function isOAuthProviderExplicitlyUnavailable(
  providers: OAuthProviderStatusMap | null,
  provider: OAuthProviderId,
) {
  return providers?.[provider]?.configured === false;
}

export function canAttemptGoogleOAuth(providers: OAuthProviderStatusMap | null) {
  return !isOAuthProviderExplicitlyUnavailable(providers, "google");
}

export function canAttemptAppleOAuth(providers: OAuthProviderStatusMap | null) {
  return providers?.apple?.configured === true;
}

export function shouldShowOAuthReadinessNote(providers: OAuthProviderStatusMap | null) {
  if (!providers) return false;
  const googleUnavailable = isOAuthProviderExplicitlyUnavailable(providers, "google");
  const appleUnavailable = isOAuthProviderExplicitlyUnavailable(providers, "apple");
  return (
    googleUnavailable &&
    appleUnavailable
  );
}

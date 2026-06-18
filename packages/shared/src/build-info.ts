export type BuildInfoService = "web" | "admin";

export type BuildInfo = {
  service: BuildInfoService;
  commitSha: string;
  sourceBranch: string;
  builtAt: string;
  environment: string;
};

type BuildInfoEnv = Record<string, string | undefined>;
export type BuildInfoFallback = Partial<Omit<BuildInfo, "service">>;

const UNKNOWN = "unknown";

function usableValue(value: string | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized || normalized.toLowerCase() === UNKNOWN) return null;
  return normalized;
}

function firstNonEmpty(env: BuildInfoEnv, keys: string[], fallback?: string): string {
  for (const key of keys) {
    const value = usableValue(env[key]);
    if (value) return value;
  }
  const fallbackValue = usableValue(fallback);
  if (fallbackValue) return fallbackValue;
  return UNKNOWN;
}

export function readBuildInfo(
  service: BuildInfoService,
  env: BuildInfoEnv = process.env,
  fallback: BuildInfoFallback = {},
): BuildInfo {
  return {
    service,
    commitSha: firstNonEmpty(env, [
      "BUILD_COMMIT_SHA",
      "COMMIT_SHA",
      "GIT_SHA",
      "GITHUB_SHA",
      "VERCEL_GIT_COMMIT_SHA",
      "SOURCE_COMMIT",
    ], fallback.commitSha),
    sourceBranch: firstNonEmpty(env, [
      "BUILD_SOURCE_BRANCH",
      "SOURCE_BRANCH",
      "GIT_BRANCH",
      "GITHUB_REF_NAME",
      "VERCEL_GIT_COMMIT_REF",
    ], fallback.sourceBranch),
    builtAt: firstNonEmpty(env, ["BUILD_CREATED_AT", "BUILD_DATE", "SOURCE_BUILD_AT"], fallback.builtAt),
    environment: firstNonEmpty(env, ["APP_ENV", "NODE_ENV"], fallback.environment),
  };
}

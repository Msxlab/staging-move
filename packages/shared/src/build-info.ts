export type BuildInfoService = "web" | "admin";

export type BuildInfo = {
  service: BuildInfoService;
  commitSha: string;
  sourceBranch: string;
  builtAt: string;
  environment: string;
};

type BuildInfoEnv = Record<string, string | undefined>;

const UNKNOWN = "unknown";

function firstNonEmpty(env: BuildInfoEnv, keys: string[]): string {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return UNKNOWN;
}

export function readBuildInfo(service: BuildInfoService, env: BuildInfoEnv = process.env): BuildInfo {
  return {
    service,
    commitSha: firstNonEmpty(env, [
      "BUILD_COMMIT_SHA",
      "COMMIT_SHA",
      "GIT_SHA",
      "GITHUB_SHA",
      "VERCEL_GIT_COMMIT_SHA",
      "SOURCE_COMMIT",
    ]),
    sourceBranch: firstNonEmpty(env, [
      "BUILD_SOURCE_BRANCH",
      "SOURCE_BRANCH",
      "GIT_BRANCH",
      "GITHUB_REF_NAME",
      "VERCEL_GIT_COMMIT_REF",
    ]),
    builtAt: firstNonEmpty(env, ["BUILD_CREATED_AT", "BUILD_DATE", "SOURCE_BUILD_AT"]),
    environment: firstNonEmpty(env, ["APP_ENV", "NODE_ENV"]),
  };
}

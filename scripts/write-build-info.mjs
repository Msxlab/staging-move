import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const UNKNOWN = "unknown";

function usable(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized && normalized.toLowerCase() !== UNKNOWN ? normalized : "";
}

function readText(path) {
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return "";
  }
}

function readPackedRef(ref) {
  const packedRefs = readText(join(".git", "packed-refs"));
  if (!packedRefs) return "";
  for (const line of packedRefs.split(/\r?\n/)) {
    if (!line || line.startsWith("#") || line.startsWith("^")) continue;
    const [sha, packedRef] = line.split(/\s+/);
    if (packedRef === ref) return sha;
  }
  return "";
}

function readGitMetadata() {
  const head = readText(join(".git", "HEAD"));
  if (!head) return { commitSha: "", sourceBranch: "" };

  if (!head.startsWith("ref:")) {
    return { commitSha: head, sourceBranch: "" };
  }

  const ref = head.slice("ref:".length).trim();
  const sourceBranch = ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : ref;
  const commitSha = readText(join(".git", ref)) || readPackedRef(ref);
  return { commitSha, sourceBranch };
}

const git = readGitMetadata();
const info = {
  commitSha: usable(process.env.BUILD_COMMIT_SHA) || usable(process.env.COMMIT_SHA) || usable(process.env.GIT_SHA) || usable(process.env.GITHUB_SHA) || usable(process.env.SOURCE_COMMIT) || usable(git.commitSha) || UNKNOWN,
  sourceBranch: usable(process.env.BUILD_SOURCE_BRANCH) || usable(process.env.SOURCE_BRANCH) || usable(process.env.GIT_BRANCH) || usable(process.env.GITHUB_REF_NAME) || usable(git.sourceBranch) || UNKNOWN,
  builtAt: usable(process.env.BUILD_CREATED_AT) || usable(process.env.BUILD_DATE) || new Date().toISOString(),
  environment: usable(process.env.APP_ENV) || usable(process.env.NODE_ENV) || "production",
};

writeFileSync(".build-info.json", `${JSON.stringify(info)}\n`);

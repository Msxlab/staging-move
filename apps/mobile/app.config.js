const { execSync } = require("node:child_process");
const { resolve } = require("node:path");

const appJson = require("./app.json");

function readGitCommit() {
  const fromEnv =
    process.env.EAS_BUILD_GIT_COMMIT_HASH ||
    process.env.EXPO_PUBLIC_GIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromEnv) return fromEnv.slice(0, 12);

  try {
    return execSync("git rev-parse --short=12 HEAD", {
      cwd: resolve(__dirname, "../.."),
      stdio: ["ignore", "pipe", "ignore"],
    }).toString().trim();
  } catch {
    return null;
  }
}

module.exports = () => ({
  ...appJson.expo,
  extra: {
    ...(appJson.expo.extra || {}),
    build: {
      commit: readGitCommit(),
      profile:
        process.env.EAS_BUILD_PROFILE ||
        process.env.EXPO_PUBLIC_ENV ||
        process.env.NODE_ENV ||
        null,
      builtAt:
        process.env.EAS_BUILD_STARTED_AT ||
        process.env.BUILD_DATE ||
        new Date().toISOString(),
    },
  },
});

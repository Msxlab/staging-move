import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const adminRoot = resolve(root, "apps/admin");
const standaloneAdminRoot = resolve(adminRoot, ".next/standalone/apps/admin");
const standaloneNextRoot = resolve(standaloneAdminRoot, ".next");

const requiredCopies = [
  {
    from: resolve(adminRoot, ".next/static"),
    to: resolve(standaloneNextRoot, "static"),
    label: "Next static assets",
  },
];

const optionalCopies = [
  {
    from: resolve(adminRoot, "public"),
    to: resolve(standaloneAdminRoot, "public"),
    label: "public assets",
  },
];

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function mustExist(path, label) {
  if (!(await exists(path))) {
    throw new Error(
      `${label} not found at ${path}. Run pnpm --filter @locateflow/admin build first.`,
    );
  }
}

async function removeStale(path, label) {
  await rm(path, { recursive: true, force: true });
  console.log(`Removed stale ${label} at ${path}`);
}

async function copyAndVerify(item) {
  await mkdir(dirname(item.to), { recursive: true });
  await cp(item.from, item.to, { recursive: true, force: true });
  await mustExist(item.to, `copied ${item.label}`);
  console.log(`Copied ${item.label} to ${item.to}`);
}

async function main() {
  await mustExist(resolve(standaloneAdminRoot, "server.js"), "standalone server");
  for (const item of requiredCopies) {
    await mustExist(item.from, item.label);
  }

  await mkdir(standaloneNextRoot, { recursive: true });
  await removeStale(resolve(standaloneNextRoot, "static"), "Next static assets");
  await removeStale(resolve(standaloneAdminRoot, "public"), "public assets");

  for (const item of requiredCopies) {
    await copyAndVerify(item);
  }

  for (const item of optionalCopies) {
    if (await exists(item.from)) {
      await copyAndVerify(item);
    } else {
      console.log(`Skipped ${item.label}; ${item.from} does not exist`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Failed to prepare standalone admin bundle");
  process.exit(1);
});

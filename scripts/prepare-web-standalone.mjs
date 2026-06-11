import { cp, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = resolve(root, "apps/web");
const standaloneRoot = resolve(webRoot, ".next/standalone");
const standaloneWebRoot = resolve(webRoot, ".next/standalone/apps/web");

const copies = [
  {
    from: resolve(webRoot, ".next/static"),
    to: resolve(standaloneWebRoot, ".next/static"),
    label: "Next static assets",
  },
  {
    from: resolve(webRoot, "public"),
    to: resolve(standaloneWebRoot, "public"),
    label: "public assets",
  },
  {
    from: resolve(root, "packages/db/package.json"),
    to: resolve(standaloneRoot, "packages/db/package.json"),
    label: "db package manifest",
  },
  {
    from: resolve(root, "packages/db/prisma"),
    to: resolve(standaloneRoot, "packages/db/prisma"),
    label: "db Prisma assets",
  },
  {
    from: resolve(root, "packages/db/src"),
    to: resolve(standaloneRoot, "packages/db/src"),
    label: "db runtime source",
  },
  {
    from: resolve(root, "packages/shared/package.json"),
    to: resolve(standaloneRoot, "packages/shared/package.json"),
    label: "shared package manifest",
  },
  {
    from: resolve(root, "packages/shared/src"),
    to: resolve(standaloneRoot, "packages/shared/src"),
    label: "shared runtime source",
  },
  {
    from: resolve(root, "packages/shared/package.json"),
    to: resolve(standaloneRoot, "node_modules/@locateflow/shared/package.json"),
    label: "shared node module manifest",
  },
  {
    from: resolve(root, "packages/shared/src"),
    to: resolve(standaloneRoot, "node_modules/@locateflow/shared/src"),
    label: "shared node module source",
  },
];

async function mustExist(path, label) {
  try {
    await stat(path);
  } catch {
    throw new Error(`${label} not found at ${path}. Run pnpm --filter @locateflow/web build first.`);
  }
}

async function main() {
  await mustExist(resolve(standaloneWebRoot, "server.js"), "standalone server");
  for (const item of copies) {
    await mustExist(item.from, item.label);
    await mkdir(dirname(item.to), { recursive: true });
    await cp(item.from, item.to, { recursive: true, force: true, dereference: true });
    console.log(`Copied ${item.label} to ${item.to}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Failed to prepare standalone web bundle");
  process.exit(1);
});

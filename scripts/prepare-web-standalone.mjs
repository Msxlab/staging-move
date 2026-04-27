import { cp, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = resolve(root, "apps/web");
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
    await mkdir(item.to, { recursive: true });
    await cp(item.from, item.to, { recursive: true, force: true });
    console.log(`Copied ${item.label} to ${item.to}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Failed to prepare standalone web bundle");
  process.exit(1);
});

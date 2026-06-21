import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function webRoot() {
  const cwd = process.cwd();
  return cwd.endsWith(path.join("apps", "web")) ? cwd : path.join(cwd, "apps", "web");
}

function walkTsx(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsx(filePath, out);
    } else if (entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")) {
      out.push(filePath);
    }
  }
  return out;
}

function lineOf(source: string, index: number) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function nestedInteractiveFindings() {
  const root = webRoot();
  const scanRoots = [
    path.join(root, "src", "app"),
    path.join(root, "src", "components"),
  ];
  const findings: string[] = [];

  for (const scanRoot of scanRoots) {
    for (const filePath of walkTsx(scanRoot)) {
      const source = readFileSync(filePath, "utf8");
      const blocks = [
        { tag: "Link", pattern: /<Link\b[\s\S]*?<\/Link>/g },
        { tag: "a", pattern: /<a\b[\s\S]*?<\/a>/g },
      ];

      for (const { tag, pattern } of blocks) {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(source))) {
          if (/<button\b/.test(match[0])) {
            const relative = path.relative(root, filePath).replace(/\\/g, "/");
            findings.push(`${relative}:${lineOf(source, match.index)} <${tag}> contains <button>`);
          }
        }
      }
    }
  }

  return findings;
}

describe("web interactive markup contract", () => {
  it("does not nest buttons inside links or anchors", () => {
    expect(nestedInteractiveFindings()).toEqual([]);
  });
});

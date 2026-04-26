import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appRoot = dirname(fileURLToPath(import.meta.url));

function read(relativePath: string) {
  return readFileSync(resolve(appRoot, relativePath), "utf8");
}

describe("admin destructive action confirmations", () => {
  it("uses a password modal instead of window.prompt for sensitive deletes", () => {
    const usersPage = read("(admin)/users/page.tsx");
    const userDetailPage = read("(admin)/users/[id]/page.tsx");
    const providersPage = read("(admin)/providers/page.tsx");
    const stateRulesPage = read("(admin)/state-rules/page.tsx");
    const modal = read("../components/password-confirm-modal.tsx");

    expect(usersPage).not.toContain("window.prompt");
    expect(userDetailPage).not.toContain("window.prompt");
    expect(providersPage).not.toContain("window.prompt");
    expect(stateRulesPage).not.toContain("confirm(");
    expect(modal).toContain('type="password"');
    expect(modal).toContain('autoComplete="off"');
    expect(modal).toContain('role="dialog"');
  });
});

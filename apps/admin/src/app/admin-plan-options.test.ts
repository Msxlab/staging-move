import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("admin billing plan options", () => {
  it("surfaces every grantable plan in user and subscription controls", () => {
    const files = [
      "src/app/(admin)/users/[id]/user-detail-client.tsx",
      "src/app/(admin)/users/page.tsx",
      "src/app/(admin)/subscriptions/subscriptions-client.tsx",
    ];

    for (const file of files) {
      const source = read(file);
      expect(source).toContain('value="FREE_TRIAL"');
      expect(source).toContain('value="INDIVIDUAL"');
      expect(source).toContain('value="FAMILY"');
      expect(source).toContain('value="PRO"');
    }
  });
});

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
      "src/app/(admin)/users/users-client.tsx",
      "src/app/(admin)/subscriptions/subscriptions-client.tsx",
    ];

    // Match the plan token whether it is surfaced as a JSX <option value="…">
    // or a data-driven option object (value: "…") — the shared DataTablePage
    // migration moved some pages from inline <option> markup to a filter
    // definition, but every grantable plan must still be selectable.
    const plans = ["FREE_TRIAL", "INDIVIDUAL", "FAMILY", "PRO"];
    for (const file of files) {
      const source = read(file);
      for (const plan of plans) {
        const present =
          source.includes(`value="${plan}"`) ||
          source.includes(`value: "${plan}"`);
        expect(present, `${file} must surface plan ${plan}`).toBe(true);
      }
    }
  });
});

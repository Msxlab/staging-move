import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = [
  { name: "home", path: "/" },
  { name: "sign-in", path: "/sign-in" },
  { name: "sign-up", path: "/sign-up" },
  { name: "pricing", path: "/pricing" },
];

for (const { name, path } of PAGES) {
  test(`${name} has no serious or critical a11y violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );

    expect(
      seriousOrCritical,
      seriousOrCritical
        .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s)`)
        .join("\n")
    ).toEqual([]);
  });
}

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = [
  { name: "home", path: "/" },
  { name: "sign-in", path: "/sign-in" },
  { name: "sign-up", path: "/sign-up" },
  { name: "pricing", path: "/pricing" },
] as const;

const THEMES = ["light", "dark"] as const;

for (const theme of THEMES) {
  for (const { name, path } of PAGES) {
    test(`${name} has no serious or critical a11y violations in ${theme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(path);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      const seriousOrCritical = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      );

      expect(
        seriousOrCritical,
        seriousOrCritical
          .map((violation) => `${violation.id} (${violation.impact}): ${violation.help} - ${violation.nodes.length} node(s)`)
          .join("\n"),
      ).toEqual([]);
    });
  }
}
